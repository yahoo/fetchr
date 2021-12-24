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
const GET = 'GET';
const RESOURCE_SANTIZER_REGEXP = /[^\w.]+/g;

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

function sanitizeResourceName(resource) {
    return resource
        ? resource.replace(RESOURCE_SANTIZER_REGEXP, '*')
        : resource;
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
 * @class Request
 * @param {String} operation The CRUD operation name: 'create|read|update|delete'.
 * @param {String} resource name of service
 * @param {Object} options configuration options for Request
 * @param {Object} [options.req] The request object from express/connect.  It can contain per-request/context data.
 * @param {Array} [options.serviceMeta] Array to hold per-request/session metadata from all service calls.
 * @param {Function} [options.statsCollector] The function will be invoked with 1 argument:
 *      the stats object, which contains resource, operation, params (request params),
 *      statusCode, err, and time (elapsed time)
 * @param {Function} [options.paramsProcessor] The function will be invoked with 3 arguments:
 *      the req object, the serviceInfo object, and the params object.  It is expected to return the processed params object.
 * @constructor
 */
class Request {
    constructor(operation, resource, options = {}) {
        if (!resource) {
            throw new Error('Resource is required for a fetcher request');
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
     * @method params
     * @memberof Request
     * @param {Object} params Information carried in query and matrix parameters in typical REST API
     * @chainable
     */
    params(params) {
        this._params =
            typeof this._paramsProcessor === 'function'
                ? this._paramsProcessor(
                      this.req,
                      { operation: this.operation, resource: this.resource },
                      params
                  )
                : params;
        return this;
    }

    /**
     * Add body to this fetcher request
     * @method body
     * @memberof Request
     * @param {Object} body The JSON object that contains the resource data being updated for this request. Not used for read and delete operations.
     * @chainable
     */
    body(body) {
        this._body = body;
        return this;
    }

    /**
     * Add clientConfig to this fetcher request
     * @method config
     * @memberof Request
     * @param {Object} config config for this fetcher request
     * @chainable
     */
    clientConfig(config) {
        this._clientConfig = config;
        return this;
    }

    /**
     * capture meta data; capture stats for this request and pass
     * stats data to options.statsCollector
     * @param {Object} errData  The error response for failed request
     * @param {Object} result  The response data for successful request
     */
    _captureMetaAndStats(errData, result) {
        const meta = (errData && errData.meta) || (result && result.meta);
        if (meta) {
            this.serviceMeta.push(meta);
        }
        if (typeof this._statsCollector === 'function') {
            const err = errData && errData.err;
            this._statsCollector({
                resource: this.resource,
                operation: this.operation,
                params: this._params,
                statusCode: err
                    ? err.statusCode
                    : (result && result.meta && result.meta.statusCode) || 200,
                err,
                time: Date.now() - this._startTime,
            });
        }
    }

    /**
     * Execute this fetcher request and call callback.
     * @method end
     * @memberof Request
     * @param {Fetcher~fetcherCallback} callback callback invoked when service is complete.
     */
    end(callback) {
        this._startTime = Date.now();

        const promise = new Promise((resolve, reject) => {
            setImmediate(executeRequest, this, resolve, reject);
        }).then(
            (result) => {
                this._captureMetaAndStats(null, result);
                return result;
            },
            (errData) => {
                this._captureMetaAndStats(errData);
                throw errData.err;
            }
        );

        if (callback) {
            promise.then(
                (result) => {
                    setImmediate(callback, null, result.data, result.meta);
                },
                (err) => {
                    setImmediate(callback, err);
                }
            );
        } else {
            return promise;
        }
    }
}

/**
 * Execute and resolve/reject this fetcher request
 * @method executeRequest
 * @param {Object} request Request instance object
 * @param {Function} resolve function to call when request fulfilled
 * @param {Function} reject function to call when request rejected
 */
function executeRequest(request, resolve, reject) {
    const args = [
        request.req,
        request.resource,
        request._params,
        request._clientConfig,
        function executeRequestCallback(err, data, meta) {
            if (err) {
                reject({ err, meta });
            } else {
                resolve({ data, meta });
            }
        },
    ];

    const op = request.operation;
    if (op === OP_CREATE || op === OP_UPDATE) {
        args.splice(3, 0, request._body);
    }

    try {
        const service = Fetcher.getService(request.resource);
        if (!service[op]) {
            throw new Error(
                `operation: ${op} is undefined on service: ${request.resource}`
            );
        }
        service[op].apply(service, args);
    } catch (err) {
        reject({ err });
    }
}

/**
 * Fetcher class for the server.
 * Provides interface to register data services and
 * to later access those services.
 * @class Fetcher
 * @param {Object} options configuration options for Fetcher
 * @param {Object} [options.req] The express request object.  It can contain per-request/context data.
 * @param {string} [options.xhrPath="/api"] The path for XHR requests. Will be ignored server side.
 * @param {Function} [options.statsCollector] The function will be invoked with 1 argument:
 *      the stats object, which contains resource, operation, params (request params),
 *      statusCode, err, and time (elapsed time)
 * @param {Function} [options.paramsProcessor] The function will be invoked with 3 arguments:
 *      the req object, the serviceInfo object, and the params object.  It is expected to return the processed params object.
 * @constructor
 */
function Fetcher(options = {}) {
    this.options = options;
    this.req = this.options.req || {};
    this._serviceMeta = [];
}

Fetcher.services = {};

Fetcher._deprecatedServicesDefinitions = [];

/**
 * DEPRECATED
 * Register a data fetcher
 * @method registerFetcher
 * @memberof Fetcher
 * @param {Function} fetcher
 */
Fetcher.registerFetcher = function (fetcher) {
    // TODO: Uncomment warnings in next minor release
    // if ('production' !== process.env.NODE_ENV) {
    //     console.warn('Fetcher.registerFetcher is deprecated. ' +
    //         'Please use Fetcher.registerService instead.');
    // }
    return Fetcher.registerService(fetcher);
};

/**
 * Register a data service
 * @method registerService
 * @memberof Fetcher
 * @param {Function} service
 */
Fetcher.registerService = function (service) {
    if (!service) {
        throw new Error(
            'Fetcher.registerService requires a service definition (ex. registerService(service)).'
        );
    }

    let resource;
    if (typeof service.resource !== 'undefined') {
        resource = service.resource;
    } else if (typeof service.name !== 'undefined') {
        resource = service.name;
        Fetcher._deprecatedServicesDefinitions.push(resource);
    } else {
        throw new Error(
            '"resource" property is missing in service definition.'
        );
    }

    Fetcher.services[resource] = service;
    return;
};

/**
 * DEPRECATED
 * Retrieve a data fetcher by name
 * @method getFetcheresourceof Fetcher
 * @param {String} name oresource @returns {Function} fetcher
 */
Fetcher.getFetcher = function (name) {
    // TODO: Uncomment warnings in next minor release
    // if ('production' !== process.env.NODE_ENV) {
    //     console.warn('Fetcher.getFetcher is deprecated. ' +
    //         'Please use Fetcher.getService instead.');
    // }
    return Fetcher.getService(name);
};

/**
 * Retrieve a data service by name
 * @method getService
 * @memberof Fetcher
 * @param {String} name of service
 * @returns {Function} service
 */
Fetcher.getService = function (name) {
    //Access service by name
    const service = Fetcher.isRegistered(name);
    if (!service) {
        throw new Error(
            `Service "${sanitizeResourceName(name)}" could not be found`
        );
    }
    return service;
};

/**
 * Returns true if service with name has been registered
 * @method isRegistered
 * @memberof Fetcher
 * @param {String} name of service
 * @returns {Boolean} true if service with name was registered
 */
Fetcher.isRegistered = function (name) {
    return name && Fetcher.services[name.split('.')[0]];
};

/**
 * Returns express/connect middleware for Fetcher
 * @method middleware
 * @memberof Fetcher
 * @param {Object} [options] Optional configurations
 * @param {Function} [options.responseFormatter=no op function] Function to modify the response
            before sending to client. First argument is the HTTP request object,
            second argument is the HTTP response object and the third argument is the service data object.
 * @param {Function} [options.statsCollector] The function will be invoked with 1 argument:
           the stats object, which contains resource, operation, params (request params),
           statusCode, err, and time (elapsed time)
 * @param {Function} [options.paramsProcessor] The function will be invoked with 3 arguments:
 *         the req object, the serviceInfo object, and the params object.  It is expected to return the processed params object.
 * @returns {Function} middleware
 *     @param {Object} req
 *     @param {Object} res
 *     @param {Object} next
 */
Fetcher.middleware = function (options = {}) {
    const responseFormatter =
        options.responseFormatter || ((req, res, data) => data);

    if (
        Fetcher._deprecatedServicesDefinitions.length &&
        'production' !== process.env.NODE_ENV
    ) {
        const deprecatedServices = Fetcher._deprecatedServicesDefinitions
            .sort()
            .join(', ');

        console.warn(`You have registered services using a deprecated property.
Please, rename the property "name" to "resource" in the
following services definitions: ${deprecatedServices}.`);
    }

    return (req, res, next) => {
        const serviceMeta = [];

        if (req.method === GET) {
            const path = req.path.substr(1).split(';');
            const resource = path.shift();

            if (!resource) {
                const error = fumble.http.badRequest('No resource specified', {
                    debug: 'Bad resource',
                });
                error.source = 'fetchr';
                return next(error);
            }

            if (!Fetcher.isRegistered(resource)) {
                const resourceName = sanitizeResourceName(resource);
                const errorMsg = `Resource "${resourceName}" is not registered`;
                const error = fumble.http.badRequest(errorMsg, {
                    debug: `Bad resource ${resourceName}`,
                });
                error.source = 'fetchr';
                return next(error);
            }

            new Request(OP_READ, resource, {
                req,
                serviceMeta,
                statsCollector: options.statsCollector,
                paramsProcessor: options.paramsProcessor,
            })
                .params(parseParamValues(qs.parse(path.join('&'))))
                .end((err, data) => {
                    const meta = serviceMeta[0] || {};

                    if (meta.headers) {
                        res.set(meta.headers);
                    }

                    if (err) {
                        const { statusCode, output } = getErrorResponse(err);
                        res.status(statusCode).json(
                            responseFormatter(req, res, { output, meta })
                        );
                    } else {
                        res.status(meta.statusCode || 200).json(
                            responseFormatter(req, res, { data, meta })
                        );
                    }
                });
        } else {
            const requests = req.body && req.body.requests;

            if (!requests || Object.keys(requests).length === 0) {
                const error = fumble.http.badRequest('No resource specified', {
                    debug: 'No resources',
                });
                error.source = 'fetchr';
                return next(error);
            }

            const DEFAULT_GUID = 'g0';
            const request = requests[DEFAULT_GUID];

            if (!Fetcher.isRegistered(request.resource)) {
                const resourceName = sanitizeResourceName(request.resource);
                const errorMsg = `Resource "${resourceName}" is not registered`;
                const error = fumble.http.badRequest(errorMsg, {
                    debug: `Bad resource ${resourceName}`,
                });
                error.source = 'fetchr';
                return next(error);
            }

            const operation = request.operation;
            if (
                operation !== OP_CREATE &&
                operation !== OP_UPDATE &&
                operation !== OP_DELETE &&
                operation !== OP_READ
            ) {
                const resourceName = sanitizeResourceName(request.resource);
                const error = fumble.http.badRequest(
                    `Unsupported "${resourceName}.${operation}" operation`,
                    {
                        debug: 'Only "create", "read", "update" or "delete" operations are allowed',
                    }
                );
                error.source = 'fetchr';
                return next(error);
            }

            new Request(operation, request.resource, {
                req,
                serviceMeta,
                statsCollector: options.statsCollector,
                paramsProcessor: options.paramsProcessor,
            })
                .params(request.params)
                .body(request.body || {})
                .end((err, data) => {
                    const meta = serviceMeta[0] || {};
                    if (meta.headers) {
                        res.set(meta.headers);
                    }
                    if (err) {
                        const { statusCode, output } = getErrorResponse(err);
                        res.status(statusCode).json(
                            responseFormatter(req, res, { output, meta })
                        );
                    } else {
                        res.status(meta.statusCode || 200).json({
                            [DEFAULT_GUID]: responseFormatter(req, res, {
                                data,
                                meta,
                            }),
                        });
                    }
                });
        }
        // TODO: Batching and multi requests
    };
};

// ------------------------------------------------------------------
// CRUD Data Access Wrapper Methods
// ------------------------------------------------------------------

/**
 * read operation (read as in CRUD).
 * @method read
 * @memberof Fetcher.prototype
 * @param {String} resource  The resource name
 * @param {Object} params    The parameters identify the resource, and along with information
 *                           carried in query and matrix parameters in typical REST API
 * @param {Object} [config={}] The config object.  It can contain "config" for per-request config data.
 * @param {Fetcher~fetcherCallback} callback callback invoked when fetcher is complete.
 * @static
 */
Fetcher.prototype.read = function (resource, params, config, callback) {
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
};

/**
 * create operation (create as in CRUD).
 * @method create
 * @memberof Fetcher.prototype
 * @param {String} resource  The resource name
 * @param {Object} params    The parameters identify the resource, and along with information
 *                           carried in query and matrix parameters in typical REST API
 * @param {Object} body      The JSON object that contains the resource data that is being created
 * @param {Object} [config={}] The config object.  It can contain "config" for per-request config data.
 * @param {Fetcher~fetcherCallback} callback callback invoked when fetcher is complete.
 * @static
 */
Fetcher.prototype.create = function (resource, params, body, config, callback) {
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
    return request.params(params).body(body).clientConfig(config).end(callback);
};

/**
 * update operation (update as in CRUD).
 * @method update
 * @memberof Fetcher.prototype
 * @param {String} resource  The resource name
 * @param {Object} params    The parameters identify the resource, and along with information
 *                           carried in query and matrix parameters in typical REST API
 * @param {Object} body      The JSON object that contains the resource data that is being updated
 * @param {Object} [config={}] The config object.  It can contain "config" for per-request config data.
 * @param {Fetcher~fetcherCallback} callback callback invoked when fetcher is complete.
 * @static
 */
Fetcher.prototype.update = function (resource, params, body, config, callback) {
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
    return request.params(params).body(body).clientConfig(config).end(callback);
};

/**
 * delete operation (delete as in CRUD).
 * @method delete
 * @memberof Fetcher.prototype
 * @param {String} resource  The resource name
 * @param {Object} params    The parameters identify the resource, and along with information
 *                           carried in query and matrix parameters in typical REST API
 * @param {Object} [config={}] The config object.  It can contain "config" for per-request config data.
 * @param {Fetcher~fetcherCallback} callback callback invoked when fetcher is complete.
 * @static
 */
Fetcher.prototype.delete = function (resource, params, config, callback) {
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
};

/**
 * update fetchr options
 * @method updateOptions
 * @memberof Fetcher.prototype
 * @param {Object} options configuration options for Fetcher
 * @param {Object} [options.req] The request object.  It can contain per-request/context data.
 * @param {string} [options.xhrPath="/api"] The path for XHR requests. Will be ignored server side.
 */
Fetcher.prototype.updateOptions = function (options) {
    this.options = Object.assign(this.options, options);
    this.req = this.options.req || {};
};

/**
 * Get all the aggregated metadata sent data services in this request
 */
Fetcher.prototype.getServiceMeta = function () {
    return this._serviceMeta;
};

module.exports = Fetcher;

/**
 * @callback Fetcher~fetcherCallback
 * @param {Object} err  The request error, pass null if there was no error. The data and meta parameters will be ignored if this parameter is not null.
 * @param {number} [err.statusCode=500] http status code to return
 * @param {string} [err.message=request failed] http response body
 * @param {Object} data request result
 * @param {Object} [meta] request meta-data
 * @param {number} [meta.statusCode=200] http status code to return
 */
