/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
const qs = require('querystring');
const fumble = require('fumble');

const OP_READ = 'read';
const OP_CREATE = 'create';
const OP_UPDATE = 'update';
const OP_DELETE = 'delete';
const RESOURCE_SANTIZER_REGEXP = /[^\w.]+/g;

class FetchrError extends Error {
    constructor(message) {
        super(message);
        this.name = 'FetchrError';
    }
}

function parseValue(value) {
    // take care of value of type: array, object
    try {
        let ret = JSON.parse(value);
        // Big interger, big decimal and the number in exponential notations will results
        // in unexpected form. e.g. 1234e1234 will be parsed into Infinity and the
        // number > MAX_SAFE_INTEGER will cause a rounding error.
        // So we will just leave them as strings instead.
        if (typeof ret === 'number' && String(value) !== String(ret)) {
            ret = value;
        }
        return ret;
    } catch (e) {
        return value;
    }
}

function parseParamValues(params) {
    return Object.keys(params).reduce((parsed, curr) => {
        parsed[curr] = parseValue(params[curr]);
        return parsed;
    }, {});
}

function parseRequest(req) {
    if (req.method === 'GET') {
        const path = req.path.substr(1).split(';');
        const resource = path.shift();
        const operation = 'read';
        const params = parseParamValues(qs.parse(path.join('&')));
        return { resource, operation, params };
    }

    const { resource, operation, body = {}, params } = req.body || {};
    return { resource, operation, body, params };
}

function sanitizeResourceName(resource) {
    return resource
        ? resource.replace(RESOURCE_SANTIZER_REGEXP, '*')
        : resource;
}

function emptyResourceError() {
    const error = fumble.http.badRequest('No resource specified', {
        debug: 'No resource',
    });
    error.source = 'fetchr';
    return error;
}

function badResourceError(resource) {
    const resourceName = sanitizeResourceName(resource);
    const errorMsg = `Resource "${resourceName}" is not registered`;
    const error = fumble.http.badRequest(errorMsg, {
        debug: `Bad resource ${resourceName}`,
    });
    error.source = 'fetchr';
    return error;
}

function badOperationError(resource, operation) {
    const resourceName = sanitizeResourceName(resource);
    const error = fumble.http.badRequest(
        `Unsupported "${resourceName}.${operation}" operation`,
        {
            debug: 'Only "create", "read", "update" or "delete" operations are allowed',
        },
    );
    error.source = 'fetchr';
    return error;
}

/**
 * Takes an error and resolves output and statusCode to respond to client with
 *
 * @param  {Error} JavaScript error
 * @return {Object} object with resolved statusCode & output
 */
function getErrorResponse(err) {
    const statusCode = err.statusCode || 500;
    let output = {
        message: 'request failed',
    };

    if (typeof err.output !== 'undefined') {
        output = err.output;
    } else if (err.message) {
        output.message = err.message;
    }

    return {
        statusCode,
        output,
    };
}

/**
 * A Request instance represents a single fetcher request.
 * The constructor requires `operation` (CRUD) and `resource`.
 */
class Request {
    /**
     * @param {String} operation The CRUD operation name: 'create|read|update|delete'.
     * @param {String} resource name of service
     * @param {Object} options configuration options for Request
     * @param {Object} [options.req] The request object from
     * express/connect. It can contain per-request/context data.
     * @param {Array} [options.serviceMeta] Array to hold
     * per-request/session metadata from all service calls.
     * @param {Function} [options.statsCollector] The function will be
     * invoked with 1 argument: the stats object, which contains
     * resource, operation, params (request params), statusCode, err,
     * and time (elapsed time)
     * @param {Function} [options.paramsProcessor] The function will
     * be invoked with 3 arguments: the req object, the serviceInfo
     * object, and the params object.  It is expected to return the
     * processed params object.
     */
    constructor(operation, resource, options = {}) {
        if (!resource) {
            throw new FetchrError('Resource is required for a fetcher request');
        }

        this.operation = operation || OP_READ;
        this.resource = resource;
        this.req = options.req || {};
        this.serviceMeta = options.serviceMeta || [];
        this._params = {};
        this._body = null;
        this._clientConfig = {};
        this._startTime = 0;
        this._statsCollector = options.statsCollector;
        this._paramsProcessor = options.paramsProcessor;
    }

    /**
     * Add params to this fetcher request
     * @param {Object} params Information carried in query and matrix
     * parameters in typical REST API.
     * @returns {this}
     */
    params(params) {
        this._params =
            typeof this._paramsProcessor === 'function'
                ? this._paramsProcessor(
                      this.req,
                      { operation: this.operation, resource: this.resource },
                      params,
                  )
                : params;
        return this;
    }

    /**
     * Add body to this fetcher request
     * @param {Object} body The JSON object that contains the resource
     * data being updated for this request. Not used for read and
     * delete operations.
     * @returns {this}
     */
    body(body) {
        this._body = body;
        return this;
    }

    /**
     * Add clientConfig to this fetcher request.
     * @param {Object} config config for this fetcher request
     * @returns {this}
     */
    clientConfig(config) {
        this._clientConfig = config;
        return this;
    }

    /**
     * Capture meta data; capture stats for this request and pass
     * stats data to options.statsCollector.
     * @param {Object} errData  The error response for failed request
     * @param {Object} result  The response data for successful request
     */
    _captureMetaAndStats(err, meta) {
        if (meta) {
            this.serviceMeta.push(meta);
        }
        if (typeof this._statsCollector === 'function') {
            this._statsCollector({
                resource: this.resource,
                operation: this.operation,
                params: this._params,
                statusCode: err
                    ? err.statusCode
                    : (meta && meta.statusCode) || 200,
                err,
                time: Date.now() - this._startTime,
            });
        }
    }

    /**
     * Execute this fetcher request
     * @returns {Promise<FetchrResponse>}
     */
    async _executeRequest() {
        if (!Fetcher.isRegistered(this.resource)) {
            const err = new FetchrError(
                `Service "${sanitizeResourceName(this.resource)}" could not be found`,
            );
            return { err };
        }

        const service = Fetcher.getService(this.resource);
        const handler = service[this.operation];

        if (!handler) {
            const err = new FetchrError(
                `operation: ${this.operation} is undefined on service: ${this.resource}`,
            );
            return { err };
        }

        return new Promise((resolve) => {
            const args = [
                this.req,
                this.resource,
                this._params,
                this._clientConfig,
                function executeRequestCallback(err, data, meta) {
                    resolve({ err, data, meta });
                },
            ];

            if (this.operation === OP_CREATE || this.operation === OP_UPDATE) {
                args.splice(3, 0, this._body);
            }

            try {
                handler.apply(service, args);
            } catch (err) {
                resolve({ err });
            }
        });
    }

    /**
     * Execute this fetcher request and call callback.
     * @param {fetcherCallback} callback callback invoked when service
     * is complete.
     */
    end(callback) {
        if (!arguments.length) {
            console.warn(
                'You called .end() without a callback. This will become an error in the future. Use .then() instead.',
            );
        }

        this._startTime = Date.now();

        return this._executeRequest().then(({ err, data, meta }) => {
            this._captureMetaAndStats(err, meta);
            if (callback) {
                callback(err, data, meta);
                return;
            }

            if (err) {
                throw err;
            }

            return { data, meta };
        });
    }

    then(resolve, reject) {
        return this.end((err, data, meta) => {
            if (err) {
                reject(err);
            } else {
                resolve({ data, meta });
            }
        });
    }

    catch(reject) {
        return this.end((err) => {
            if (err) {
                reject(err);
            }
        });
    }
}

class Fetcher {
    /**
     * Fetcher class for the server.
     * Provides interface to register data services and
     * to later access those services.
     * @class Fetcher
     * @param {Object} options configuration options for Fetcher.
     * @param {Object} [options.req] The express request object. It
     * can contain per-request/context data.
     * @param {string} [options.xhrPath="/api"] The path for XHR
     * requests. Will be ignored server side.
     * @param {Function} [options.statsCollector] The function will be
     * invoked with 1 argument: the stats object, which contains
     * resource, operation, params (request params), statusCode, err,
     * and time (elapsed time).
     * @param {Function} [options.paramsProcessor] The function will
     * be invoked with 3 arguments: the req object, the serviceInfo
     * object, and the params object.  It is expected to return the
     * processed params object.
     * @constructor
     */
    constructor(options = {}) {
        this.options = options;
        this.req = this.options.req || {};
        this._serviceMeta = [];
    }

    static services = {};

    static _deprecatedServicesDefinitions = [];

    /**
     * Register a data fetcher
     * @deprecated Use registerService.
     * @param {Function} fetcher
     */
    static registerFetcher(fetcher) {
        // TODO: Uncomment warnings in next minor release
        // if ('production' !== process.env.NODE_ENV) {
        //     console.warn('Fetcher.registerFetcher is deprecated. ' +
        //         'Please use Fetcher.registerService instead.');
        // }
        return Fetcher.registerService(fetcher);
    }

    /**
     * Register a data service
     * @param {Function} service
     */
    static registerService(service) {
        if (!service) {
            throw new FetchrError(
                'Fetcher.registerService requires a service definition (ex. registerService(service)).',
            );
        }

        let resource;
        if (typeof service.resource !== 'undefined') {
            resource = service.resource;
        } else if (typeof service.name !== 'undefined') {
            resource = service.name;
            Fetcher._deprecatedServicesDefinitions.push(resource);
        } else {
            throw new FetchrError(
                '"resource" property is missing in service definition.',
            );
        }

        Fetcher.services[resource] = service;
        return;
    }

    /**
     * Retrieve a data fetcher by name
     * @deprecated Use getService
     * @param {String} name oresource @returns {Function} fetcher.
     */
    static getFetcher(name) {
        // TODO: Uncomment warnings in next minor release
        // if ('production' !== process.env.NODE_ENV) {
        //     console.warn('Fetcher.getFetcher is deprecated. ' +
        //         'Please use Fetcher.getService instead.');
        // }
        return Fetcher.getService(name);
    }

    /**
     * Retrieve a data service by name
     * @param {String} name of service
     * @returns {Function} service
     */
    static getService(name) {
        //Access service by name
        const service = Fetcher.isRegistered(name);
        if (!service) {
            throw new FetchrError(
                `Service "${sanitizeResourceName(name)}" could not be found`,
            );
        }
        return service;
    }

    /**
     * Returns true if service with name has been registered
     * @param {String} name of service
     * @returns {Boolean} true if service with name was registered
     */
    static isRegistered(name) {
        return name && Fetcher.services[name.split('.')[0]];
    }

    /**
     * Returns express/connect middleware for Fetcher
     * @param {Object} [options] Optional configurations
     * @param {Function} [options.responseFormatter=no op function]
     * Function to modify the response before sending to client. First
     * argument is the HTTP request object, second argument is the
     * HTTP response object and the third argument is the service data
     * object.
     * @param {Function} [options.statsCollector] The function will be
     * invoked with 1 argument: the stats object, which contains
     * resource, operation, params (request params), statusCode, err,
     * and time (elapsed time).
     * @param {Function} [options.paramsProcessor] The function will
     * be invoked with 3 arguments: the req object, the serviceInfo
     * object, and the params object.  It is expected to return the
     * processed params object.
     * @returns {Function} middleware
     */
    static middleware(options = {}) {
        if (
            Fetcher._deprecatedServicesDefinitions.length &&
            'production' !== process.env.NODE_ENV
        ) {
            const services = Fetcher._deprecatedServicesDefinitions
                .sort()
                .join(', ');

            console.warn(`You have registered services using a deprecated property.
Please, rename the property "name" to "resource" in the
following services definitions: ${services}.`);
        }

        const { paramsProcessor, statsCollector, responseFormatter } = options;
        const formatResponse = responseFormatter || ((req, res, data) => data);

        return (req, res, next) => {
            const { body, operation, params, resource } = parseRequest(req);

            if (!resource) {
                return next(emptyResourceError());
            }

            if (!Fetcher.isRegistered(resource)) {
                return next(badResourceError(resource));
            }

            if (
                operation !== OP_CREATE &&
                operation !== OP_UPDATE &&
                operation !== OP_DELETE &&
                operation !== OP_READ
            ) {
                return next(badOperationError(resource, operation));
            }

            new Request(operation, resource, {
                req,
                statsCollector,
                paramsProcessor,
            })
                .params(params)
                .body(body)
                .end((err, data, meta = {}) => {
                    if (meta.headers) {
                        res.set(meta.headers);
                    }
                    if (err) {
                        const { statusCode, output } = getErrorResponse(err);
                        res.status(statusCode).json(
                            formatResponse(req, res, { output, meta }),
                        );
                    } else {
                        res.status(meta.statusCode || 200).json(
                            formatResponse(req, res, { data, meta }),
                        );
                    }
                });
        };
    }

    /**
     * read operation (read as in CRUD).
     * @param {String} resource The resource name.
     * @param {Object} params The parameters identify the resource,
     * and along with information carried in query and matrix
     * parameters in typical REST API.
     * @param {Object} [config={}] The config object. It can contain
     * "config" for per-request config data.
     * @param {fetcherCallback} callback callback invoked when fetcher
     * is complete.
     */
    read(resource, params, config, callback) {
        const request = new Request('read', resource, {
            req: this.req,
            serviceMeta: this._serviceMeta,
            statsCollector: this.options.statsCollector,
        });
        if (1 === arguments.length) {
            return request;
        }
        // TODO: Uncomment warnings in next minor release
        // if ('production' !== process.env.NODE_ENV) {
        //     console.warn('The recommended way to use fetcher\'s .read method is \n' +
        //         '.read(\'' + resource + '\').params({foo:bar}).end(callback);');
        // }
        // TODO: Remove below this line in release after next
        if (typeof config === 'function') {
            callback = config;
            config = {};
        }
        return request.params(params).clientConfig(config).end(callback);
    }

    /**
     * Create operation (create as in CRUD).
     * @param {String} resource The resource name.
     * @param {Object} params The parameters identify the resource,
     * and along with information carried in query and matrix
     * parameters in typical REST API.
     * @param {Object} body The JSON object that contains the resource
     * data that is being created.
     * @param {Object} [config={}] The config object. It can contain
     * "config" for per-request config data.
     * @param {fetcherCallback} callback callback invoked when fetcher
     * is complete.
     */
    create(resource, params, body, config, callback) {
        const request = new Request('create', resource, {
            req: this.req,
            serviceMeta: this._serviceMeta,
            statsCollector: this.options.statsCollector,
        });
        if (1 === arguments.length) {
            return request;
        }
        // TODO: Uncomment warnings in next minor release
        // if ('production' !== process.env.NODE_ENV) {
        //     console.warn('The recommended way to use fetcher\'s .create method is \n' +
        //         '.create(\'' + resource + '\').params({foo:bar}).body({}).end(callback);');
        // }
        // TODO: Remove below this line in release after next
        if (typeof config === 'function') {
            callback = config;
            config = {};
        }
        return request
            .params(params)
            .body(body)
            .clientConfig(config)
            .end(callback);
    }

    /**
     * Update operation (update as in CRUD).
     * @param {String} resource The resource name
     * @param {Object} params The parameters identify the resource,
     * and along with information carried in query and matrix
     * parameters in typical REST API.
     * @param {Object} body The JSON object that contains the resource
     * data that is being updated.
     * @param {Object} [config={}] The config object. It can contain
     * "config" for per-request config data.
     * @param {fetcherCallback} callback callback invoked when
     * fetcher is complete.
     */
    update(resource, params, body, config, callback) {
        const request = new Request('update', resource, {
            req: this.req,
            serviceMeta: this._serviceMeta,
            statsCollector: this.options.statsCollector,
        });
        if (1 === arguments.length) {
            return request;
        }
        // TODO: Uncomment warnings in next minor release
        // if ('production' !== process.env.NODE_ENV) {
        //     console.warn('The recommended way to use fetcher\'s .update method is \n' +
        //         '.update(\'' + resource + '\').params({foo:bar}).body({}).end(callback);');
        // }
        // TODO: Remove below this line in release after next
        if (typeof config === 'function') {
            callback = config;
            config = {};
        }
        return request
            .params(params)
            .body(body)
            .clientConfig(config)
            .end(callback);
    }

    /**
     * Delete operation (delete as in CRUD).
     * @param {String} resource The resource name
     * @param {Object} params The parameters identify the resource,
     * and along with information carried in query and matrix
     * parameters in typical REST API.
     * @param {Object} [config={}] The config object. It can contain
     * "config" for per-request config data.
     * @param {fetcherCallback} callback callback invoked when
     * fetcher is complete.
     */
    delete(resource, params, config, callback) {
        const request = new Request('delete', resource, {
            req: this.req,
            serviceMeta: this._serviceMeta,
            statsCollector: this.options.statsCollector,
        });
        if (1 === arguments.length) {
            return request;
        }

        // TODO: Uncomment warnings in next minor release
        // if ('production' !== process.env.NODE_ENV) {
        //     console.warn('The recommended way to use fetcher\'s .read method is \n' +
        //         '.read(\'' + resource + '\').params({foo:bar}).end(callback);');
        // }
        // TODO: Remove below this line in release after next
        if (typeof config === 'function') {
            callback = config;
            config = {};
        }
        return request.params(params).clientConfig(config).end(callback);
    }

    /**
     * Update fetchr options
     * @param {Object} options configuration options for Fetcher.
     * @param {string} [options.xhrPath="/api"] The path for XHR
     * requests. Will be ignored server side.
     * @param {Object} [options.req] The request object. It can
     * contain per-request/context data.
     */
    updateOptions(options) {
        this.options = Object.assign(this.options, options);
        this.req = this.options.req || {};
    }

    /**
     * Get all the aggregated metadata sent data services in this
     * request.
     */
    getServiceMeta() {
        return this._serviceMeta;
    }
}

module.exports = Fetcher;

/**
 * @callback fetcherCallback
 * @param {Object} err The request error, pass null if there was no
 * error. The data and meta parameters will be ignored if this
 * parameter is not null.
 * @param {number} [err.statusCode=500] http status code to return
 * @param {string} [err.message=request failed] http response body
 * @param {Object} data request result
 * @param {Object} [meta] request meta-data
 * @param {number} [meta.statusCode=200] http status code to return
 */

/**
 * @typedef {Object} FetchrResponse
 * @property {?object} data - Any data returned by the fetchr resource.
 * @property {?object} meta - Any meta data returned by the fetchr resource.
 * @property {?Error} err - an error that occurred before, during or
 * after request was sent.
 */
