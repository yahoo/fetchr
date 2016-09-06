/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

var OP_READ = 'read';
var OP_CREATE = 'create';
var OP_UPDATE = 'update';
var OP_DELETE = 'delete';
var GET = 'GET';
var qs = require('querystring');
var debug = require('debug')('Fetchr');
var fumble = require('fumble');
var objectAssign = require('object-assign');
var Promise = global.Promise || require('es6-promise').Promise;
var RESOURCE_SANTIZER_REGEXP = /[^\w\.]+/g;

function parseValue(value) {
    // take care of value of type: array, object
    try {
        var ret = JSON.parse(value);
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

function parseParamValues (params) {
    return Object.keys(params).reduce(function (parsed, curr) {
        parsed[curr] = parseValue(params[curr]);
        return parsed;
    }, {});
}

function sanitizeResourceName(resource) {
    return resource ? resource.replace(RESOURCE_SANTIZER_REGEXP, '*') : resource;
}

/**
 * Takes an error and resolves output and statusCode to respond to client with
 *
 * @param  {Error} JavaScript error
 * @return {Object} object with resolved statusCode & output
 */
function getErrorResponse(err) {
    var statusCode = err.statusCode || 500;
    var output = {
        message: 'request failed'
    };

    if (typeof err.output !== 'undefined') {
        output = err.output;
    } else if (err.message) {
        output.message = err.message;
    }

    return {
        statusCode: statusCode,
        output: output
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
 * @constructor
 */
function Request (operation, resource, options) {
    if (!resource) {
        throw new Error('Resource is required for a fetcher request');
    }

    this.operation = operation || OP_READ;
    this.resource = resource;
    options = options || {};
    this.req = options.req || {};
    this.serviceMeta = options.serviceMeta || [];
    this._params = {};
    this._body = null;
    this._clientConfig = {};
    this._startTime = 0;
    this._statsCollector = options.statsCollector;
}

/**
 * Add params to this fetcher request
 * @method params
 * @memberof Request
 * @param {Object} params Information carried in query and matrix parameters in typical REST API
 * @chainable
 */
Request.prototype.params = function (params) {
    this._params = params;
    return this;
};
/**
 * Add body to this fetcher request
 * @method body
 * @memberof Request
 * @param {Object} body The JSON object that contains the resource data being updated for this request.
 *                      Not used for read and delete operations.
 * @chainable
 */
Request.prototype.body = function (body) {
    this._body = body;
    return this;
};
/**
 * Add clientConfig to this fetcher request
 * @method config
 * @memberof Request
 * @param {Object} config config for this fetcher request
 * @chainable
 */
Request.prototype.clientConfig = function (config) {
    this._clientConfig = config;
    return this;
};

/**
 * capture meta data; capture stats for this request and pass stats data
 * to options.statsCollector
 * @method _captureMetaAndStats
 * @param {Object} errData  The error response for failed request
 * @param {Object} result  The response data for successful request
 */
Request.prototype._captureMetaAndStats = function (errData, result) {
    var self = this;
    var meta = (errData && errData.meta) || (result && result.meta);
    if (meta) {
        self.serviceMeta.push(meta);
    }
    var statsCollector = self._statsCollector;
    if (typeof statsCollector === 'function') {
        var err = errData && errData.err;
        var stats = {
            resource: self.resource,
            operation: self.operation,
            params: self._params,
            statusCode: err ? err.statusCode : (result && result.meta && result.meta.statusCode || 200),
            err: err,
            time: Date.now() - self._startTime
        };
        statsCollector(stats);
    }
};

/**
 * Execute this fetcher request and call callback.
 * @method end
 * @memberof Request
 * @param {Fetcher~fetcherCallback} callback callback invoked when service is complete.
 */
Request.prototype.end = function (callback) {
    var self = this;
    self._startTime = Date.now();

    var promise = new Promise(function requestExecutor(resolve, reject) {
        setImmediate(executeRequest, self, resolve, reject);
    });

    promise = promise.then(function requestSucceeded(result) {
        self._captureMetaAndStats(null, result);
        return result;
    }, function requestFailed(errData) {
        self._captureMetaAndStats(errData);
        throw errData.err;
    });

    if (callback) {
        promise.then(function requestSucceeded(result) {
            setImmediate(callback, null, result.data, result.meta);
        }, function requestFailed(err) {
            setImmediate(callback, err);
        });
    } else {
        return promise;
    }
};

/**
 * Execute and resolve/reject this fetcher request
 * @method executeRequest
 * @param {Object} request Request instance object
 * @param {Function} resolve function to call when request fulfilled
 * @param {Function} reject function to call when request rejected
 */
function executeRequest (request, resolve, reject) {
    var args = [request.req, request.resource, request._params, request._clientConfig, function executeRequestCallback(err, data, meta) {
        if (err) {
            reject({
                err: err,
                meta: meta
            });
        } else {
            resolve({
                data: data,
                meta: meta
            });
        }
    }];
    var op = request.operation;
    if ((op === OP_CREATE) || (op === OP_UPDATE)) {
        args.splice(3, 0, request._body);
    }
    var service;
    try {
        service = Fetcher.getService(request.resource);
        if (!service[op]) {
          throw new Error('operation: ' + op + ' is undefined on service: ' + request.resource);
        }
        service[op].apply(service, args);
    } catch (err) {
        reject({err: err});
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
 * @constructor
 */
function Fetcher (options) {
    this.options = options || {};
    this.req = this.options.req || {};
    this._serviceMeta = [];
}

Fetcher.services = {};

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
Fetcher.registerService = function (fetcher) {
    if (!fetcher || !fetcher.name) {
        throw new Error('Service is not defined correctly');
    }
    Fetcher.services[fetcher.name] = fetcher;
    debug('fetcher ' + fetcher.name + ' added');
    return;
};

/**
 * DEPRECATED
 * Retrieve a data fetcher by name
 * @method getFetcher
 * @memberof Fetcher
 * @param {String} name of fetcher
 * @returns {Function} fetcher
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
    var service = Fetcher.isRegistered(name);
    if (!service) {
        throw new Error('Service "' + sanitizeResourceName(name) + '" could not be found');
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
 * @returns {Function} middleware
 *     @param {Object} req
 *     @param {Object} res
 *     @param {Object} next
 */
Fetcher.middleware = function (options) {
    options = options || {};
    var responseFormatter = options.responseFormatter || function noOp(req, res, data) {
        return data;
    };
    return function (req, res, next) {
        var request;
        var error;
        var serviceMeta;

        if (req.method === GET) {
            var path = req.path.substr(1).split(';');
            var resource = path.shift();

            if (!Fetcher.isRegistered(resource)) {
                error = fumble.http.badRequest('Invalid Fetchr Access', {
                    debug: 'Bad resource ' + sanitizeResourceName(resource)
                });
                error.source = 'fetchr';
                return next(error);
            }
            serviceMeta = [];
            request = new Request(OP_READ, resource, {
                req: req,
                serviceMeta: serviceMeta,
                statsCollector: options.statsCollector
            });
            request
                .params(parseParamValues(qs.parse(path.join('&'))))
                .end(function (err, data) {
                    var meta = serviceMeta[0] || {};
                    if (meta.headers) {
                        res.set(meta.headers);
                    }
                    if (err) {
                        var errResponse = getErrorResponse(err);
                        if (req.query && req.query.returnMeta) {
                            res.status(errResponse.statusCode).json(responseFormatter(req, res, {
                                output: errResponse.output,
                                meta: meta
                            }));
                        } else {
                            res.status(errResponse.statusCode).json(responseFormatter(req, res, errResponse.output));
                        }
                        return;
                    }
                    if (req.query.returnMeta) {
                        res.status(meta.statusCode || 200).json(responseFormatter(req, res, {
                            data: data,
                            meta: meta
                        }));
                    } else {
                        // TODO: Remove `returnMeta` feature flag after next release
                        res.status(meta.statusCode || 200).json(data);
                    }
                });
        } else {
            var requests = req.body && req.body.requests;

            if (!requests || Object.keys(requests).length === 0) {
                error = fumble.http.badRequest('Invalid Fetchr Access', {
                    debug: 'No resources'
                });
                error.source = 'fetchr';
                return next(error);
            }

            var DEFAULT_GUID = 'g0';
            var singleRequest = requests[DEFAULT_GUID];

            if (!Fetcher.isRegistered(singleRequest.resource)) {
                error = fumble.http.badRequest('Invalid Fetchr Access', {
                    debug: 'Bad resource ' + sanitizeResourceName(singleRequest.resource)
                });
                error.source = 'fetchr';
                return next(error);
            }
            var operation = singleRequest.operation;
            if(operation !== OP_CREATE && operation !== OP_UPDATE && operation !== OP_DELETE && operation !== OP_READ) {
                error = fumble.http.badRequest('Invalid Fetchr Access', {
                    debug: 'Unsupported operation : operation must be create or read or update or delete'
                });
                error.source = 'fetchr';
                return next(error);
            }
            serviceMeta = [];
            request = new Request(operation, singleRequest.resource, {
                req: req,
                serviceMeta: serviceMeta,
                statsCollector: options.statsCollector
            });
            request
                .params(singleRequest.params)
                .body(singleRequest.body || {})
                .end(function(err, data) {
                    var meta = serviceMeta[0] || {};
                    if (meta.headers) {
                        res.set(meta.headers);
                    }
                    if (err) {
                        var errResponse = getErrorResponse(err);
                        res.status(errResponse.statusCode).json(responseFormatter(req, res, errResponse.output));
                        return;
                    }
                    var responseObj = {};
                    responseObj[DEFAULT_GUID] = responseFormatter(req, res, {
                        data: data,
                        meta: meta
                    });
                    res.status(meta.statusCode || 200).json(responseObj);
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
    var request = new Request('read', resource, {
        req: this.req,
        serviceMeta: this._serviceMeta,
        statsCollector: this.options.statsCollector
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
    return request
        .params(params)
        .clientConfig(config)
        .end(callback);
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
    var request = new Request('create', resource, {
        req: this.req,
        serviceMeta: this._serviceMeta,
        statsCollector: this.options.statsCollector
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
    var request = new Request('update', resource, {
        req: this.req,
        serviceMeta: this._serviceMeta,
        statsCollector: this.options.statsCollector
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
Fetcher.prototype['delete'] = function (resource, params, config, callback) {
    var request = new Request('delete', resource, {
        req: this.req,
        serviceMeta: this._serviceMeta,
        statsCollector: this.options.statsCollector
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
    return request
        .params(params)
        .clientConfig(config)
        .end(callback);
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
    this.options = objectAssign(this.options, options);
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
