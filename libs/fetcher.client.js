/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/*jslint plusplus:true,nomen:true */

/**
 * Fetcher is a CRUD interface for your data.
 * @module Fetcher
 */
require("setimmediate");
var REST = require('./util/http.client');
var deepmerge = require('deepmerge');
var DEFAULT_GUID = 'g0';
var DEFAULT_XHR_PATH = '/api';
var DEFAULT_XHR_TIMEOUT = 3000;
var MAX_URI_LEN = 2048;
var OP_READ = 'read';
var defaultConstructGetUri = require('./util/defaultConstructGetUri');
var forEach = require('./util/forEach');
var Promise = global.Promise || require('es6-promise').Promise;

function isFunction(value) {
    return typeof value === 'function';
}

function parseResponse(response) {
    if (response && response.responseText) {
        try {
            return JSON.parse(response.responseText);
        } catch (e) {
            return null;
        }
    }
    return null;
}

/**
 * Pick keys from the context object
 * @method pickContext
 * @param {Object} context - context object
 * @param {Function|Array|String} picker - key, array of keys or
 * function that return keys to be extracted from context.
 * @param {String} method - method name, GET or POST
 */
function pickContext (context, picker, method) {
    if (!picker || !picker[method]) {
        return context;
    }

    var p = picker[method];
    var result = {};

    if (typeof p === 'string') {
        result[p] = context[p];
    } else if (Array.isArray(p)) {
        p.forEach(function(key) {
            result[key] = context[key];
        });
    } else if (typeof p === 'function') {
        forEach(context, function(value, key) {
            if (p(value, key, context)) {
                result[key] = context[key];
            }
        })
    } else {
        throw new TypeError('picker must be an string, an array, or a function.');
    }

    return result;
}

/**
 * A RequestClient instance represents a single fetcher request.
 * The constructor requires `operation` (CRUD) and `resource`.
 * @class RequestClient
 * @param {String} operation The CRUD operation name: 'create|read|update|delete'.
 * @param {String} resource name of fetcher/service
 * @param {Object} options configuration options for Request
 * @param {Array} [options._serviceMeta] Array to hold per-request/session metadata from all service calls.
 * Data will be pushed on to this array while the Fetchr instance maintains the reference for this session.
 *
 * @constructor
 */
function Request (operation, resource, options) {
    if (!resource) {
        throw new Error('Resource is required for a fetcher request');
    }

    this.operation = operation || OP_READ;
    this.resource = resource;
    this.options = {
        headers: options.headers,
        xhrPath: options.xhrPath || DEFAULT_XHR_PATH,
        xhrTimeout: options.xhrTimeout || DEFAULT_XHR_TIMEOUT,
        corsPath: options.corsPath,
        context: options.context || {},
        contextPicker: options.contextPicker || {},
        statsCollector: options.statsCollector,
        _serviceMeta: options._serviceMeta || []
    };
    this._params = {};
    this._body = null;
    this._clientConfig = {};
    this._startTime = 0;
}

/**
 * Add params to this fetcher request
 * @method params
 * @memberof Request
 * @param {Object} params Information carried in query and matrix parameters in typical REST API
 * @chainable
 */
Request.prototype.params = function (params) {
    this._params = params || {};
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
    this._body = body || null;
    return this;
};

/**
 * Add clientConfig to this fetcher request
 * @method clientConfig
 * @memberof Request
 * @param {Object} config config for this fetcher request
 * @chainable
 */
Request.prototype.clientConfig = function (config) {
    this._clientConfig = config || {};
    return this;
};

/**
 * capture meta data; capture stats for this request and pass stats data
 * to options.statsCollector
 * @method _captureMetaAndStats
 * @param {Object} err  The error response for failed request
 * @param {Object} result  The response data for successful request
 */
Request.prototype._captureMetaAndStats = function (err, result) {
    var self = this;
    var meta = (err && err.meta) || (result && result.meta);
    if (meta) {
        self.options._serviceMeta.push(meta);
    }
    var statsCollector = self.options.statsCollector;
    if (typeof statsCollector === 'function') {
        var stats = {
            resource: self.resource,
            operation: self.operation,
            params: self._params,
            statusCode: err ? err.statusCode : 200,
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
 * @param {Fetcher~fetcherCallback} callback callback invoked when fetcher/service is complete.
 * @async
 */
Request.prototype.end = function (callback) {
    var self = this;
    self._startTime = Date.now();

    if (callback) {
        return executeRequest(self, function requestSucceeded(result) {
            self._captureMetaAndStats(null, result);
            setImmediate(callback, null, result && result.data, result && result.meta);
        }, function requestFailed(err) {
            self._captureMetaAndStats(err);
            setImmediate(callback, err);
        });
    } else {
        var promise = new Promise(function requestExecutor(resolve, reject) {
            setImmediate(executeRequest, self, resolve, reject);
        });
        promise = promise.then(function requestSucceeded(result) {
            self._captureMetaAndStats(null, result);
            return result;
        }, function requestFailed(err) {
            self._captureMetaAndStats(err);
            throw err;
        });
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
    var clientConfig = request._clientConfig;
    var use_post;
    var allow_retry_post;
    var uri = clientConfig.uri;
    var requests;
    var data;

    if (!uri) {
        uri = clientConfig.cors ? request.options.corsPath : request.options.xhrPath;
    }

    use_post = request.operation !== OP_READ || clientConfig.post_for_read;
    // We use GET request by default for READ operation, but you can override that behavior
    // by specifying {post_for_read: true} in your request's clientConfig
    if (!use_post) {
        var getUriFn = isFunction(clientConfig.constructGetUri) ? clientConfig.constructGetUri : defaultConstructGetUri;
        var get_uri = getUriFn.call(request, uri, request.resource, request._params, clientConfig, pickContext(request.options.context, request.options.contextPicker, 'GET'));
        /* istanbul ignore next */
        if (!get_uri) {
            // If a custom getUriFn returns falsy value, we should run defaultConstructGetUri
            // TODO: Add test for this fallback
            get_uri = defaultConstructGetUri.call(request, uri, request.resource, request._params, clientConfig, request.options.context);
        }
        // TODO: Remove `returnMeta` feature flag after next release
        // This feature flag will enable the new return format for GET api requests
        // Whereas before any data from services was returned as is. We now return
        // an object with a data key containing the service response, and a meta key
        // containing the service's metadata response (i.e headers and statusCode).
        // We need this feature flag to be truly backwards compatible because it is
        // concievable that some active browser sessions could have the old version of
        // client fetcher while the server upgrades to the new version. This could be
        // easily fixed by refreshing the browser, but the feature flag will ensure
        // old fetcher clients will receive the old format and the new client will
        // receive the new format
        get_uri += (get_uri.indexOf('?') !== -1) ? '&' : '?';
        get_uri += 'returnMeta=true';
        if (get_uri.length <= MAX_URI_LEN) {
            uri = get_uri;
        } else {
            use_post = true;
        }
    }

    var customHeaders = clientConfig.headers || request.options.headers || {};
    if (!use_post) {
        return REST.get(uri, customHeaders, deepmerge({xhrTimeout: request.options.xhrTimeout}, clientConfig), function getDone(err, response) {
            if (err) {
                return reject(err);
            }
            resolve(parseResponse(response));
        });
    }

    // individual request is also normalized into a request hash to pass to api
    requests = {};
    requests[DEFAULT_GUID] = {
        resource: request.resource,
        operation: request.operation,
        params: request._params
    };
    if (request._body) {
        requests[DEFAULT_GUID].body = request._body;
    }
    data = {
        requests: requests,
        context: request.options.context
    }; // TODO: remove. leave here for now for backward compatibility
    uri = request._constructGroupUri(uri);
    allow_retry_post = (request.operation === OP_READ);
    return REST.post(uri, customHeaders, data, deepmerge({unsafeAllowRetry: allow_retry_post, xhrTimeout: request.options.xhrTimeout}, clientConfig), function postDone(err, response) {
        if (err) {
            return reject(err);
        }
        var result = parseResponse(response);
        if (result) {
            result = result[DEFAULT_GUID] || {};
        } else {
            result = {};
        }
        resolve(result);
    });
}

/**
 * Build a final uri by adding query params to base uri from this.context
 * @method _constructGroupUri
 * @param {String} uri the base uri
 * @private
 */
Request.prototype._constructGroupUri = function (uri) {
    var query = [];
    var final_uri = uri;
    forEach(pickContext(this.options.context, this.options.contextPicker, 'POST'), function eachContext(v, k) {
        query.push(k + '=' + encodeURIComponent(v));
    });
    if (query.length > 0) {
        final_uri += '?' + query.sort().join('&');
    }
    return final_uri;
};

/**
 * Fetcher class for the client. Provides CRUD methods.
 * @class FetcherClient
 * @param {Object} options configuration options for Fetcher
 * @param {String} [options.xhrPath="/api"] The path for XHR requests
 * @param {Number} [options.xhrTimout=3000] Timeout in milliseconds for all XHR requests
 * @param {Boolean} [options.corsPath] Base CORS path in case CORS is enabled
 * @param {Object} [options.context] The context object that is propagated to all outgoing
 *      requests as query params.  It can contain current-session/context data that should
 *      persist to all requests.
 * @param {Object} [options.contextPicker] The context picker for GET
 *      and POST, they must be a string, a an array or function with
 *      three arguments (value, key, object) to extract keys from
 *      context.
 * @param {Function|String|String[]} [options.contextPicker.GET] GET context picker
 * @param {Function|String|String[]} [options.contextPicker.POST] POST context picker
 * @param {Function} [options.statsCollector] The function will be invoked with 1 argument:
 *      the stats object, which contains resource, operation, params (request params),
 *      statusCode, err, and time (elapsed time)
 */

function Fetcher (options) {
    this._serviceMeta = [];
    this.options = {
        headers: options.headers,
        xhrPath: options.xhrPath,
        xhrTimeout: options.xhrTimeout,
        corsPath: options.corsPath,
        context: options.context,
        contextPicker: options.contextPicker,
        statsCollector: options.statsCollector,
        _serviceMeta: this._serviceMeta
    };
}

Fetcher.prototype = {
    // ------------------------------------------------------------------
    // Data Access Wrapper Methods
    // ------------------------------------------------------------------

    /**
     * create operation (create as in CRUD).
     * @method create
     * @param {String} resource     The resource name
     * @param {Object} params       The parameters identify the resource, and along with information
     *                              carried in query and matrix parameters in typical REST API
     * @param {Object} body         The JSON object that contains the resource data that is being created
     * @param {Object} clientConfig The "config" object for per-request config data.
     * @param {Function} callback   callback convention is the same as Node.js
     * @static
     */
    create: function (resource, params, body, clientConfig, callback) {
        var request = new Request('create', resource, this.options);
        if (1 === arguments.length) {
            return request;
        }
        // TODO: Remove below this line in release after next
        if (typeof clientConfig === 'function') {
            callback = clientConfig;
            clientConfig = {};
        }
        return request
            .params(params)
            .body(body)
            .clientConfig(clientConfig)
            .end(callback);
    },

    /**
     * read operation (read as in CRUD).
     * @method read
     * @param {String} resource     The resource name
     * @param {Object} params       The parameters identify the resource, and along with information
     *                              carried in query and matrix parameters in typical REST API
     * @param {Object} clientConfig The "config" object for per-request config data.
     * @param {Function} callback   callback convention is the same as Node.js
     * @static
     */
    read: function (resource, params, clientConfig, callback) {
        var request = new Request('read', resource, this.options);
        if (1 === arguments.length) {
            return request;
        }
        // TODO: Remove below this line in release after next
        if (typeof clientConfig === 'function') {
            callback = clientConfig;
            clientConfig = {};
        }
        return request
            .params(params)
            .clientConfig(clientConfig)
            .end(callback);
    },

    /**
     * update operation (update as in CRUD).
     * @method update
     * @param {String} resource     The resource name
     * @param {Object} params       The parameters identify the resource, and along with information
     *                              carried in query and matrix parameters in typical REST API
     * @param {Object} body         The JSON object that contains the resource data that is being updated
     * @param {Object} clientConfig The "config" object for per-request config data.
     * @param {Function} callback   callback convention is the same as Node.js
     * @static
     */
    update: function (resource, params, body, clientConfig, callback) {
        var request = new Request('update', resource, this.options);
        if (1 === arguments.length) {
            return request;
        }
        // TODO: Remove below this line in release after next
        if (typeof clientConfig === 'function') {
            callback = clientConfig;
            clientConfig = {};
        }
        return request
            .params(params)
            .body(body)
            .clientConfig(clientConfig)
            .end(callback);
    },

    /**
     * delete operation (delete as in CRUD).
     * @method delete
     * @param {String} resource     The resource name
     * @param {Object} params       The parameters identify the resource, and along with information
     *                              carried in query and matrix parameters in typical REST API
     * @param {Object} clientConfig The "config" object for per-request config data.
     * @param {Function} callback   callback convention is the same as Node.js
     * @static
     */
    'delete': function (resource, params, clientConfig, callback) {
        var request = new Request('delete', resource, this.options);
        if (1 === arguments.length) {
            return request;
        }
        // TODO: Remove below this line in release after next
        if (typeof clientConfig === 'function') {
            callback = clientConfig;
            clientConfig = {};
        }
        return request
            .params(params)
            .clientConfig(clientConfig)
            .end(callback);
    },

    /**
     * Update options
     * @method updateOptions
     */
    updateOptions: function (options) {
        this.options = deepmerge(this.options, options);
    },

    /**
     * get the serviceMeta array.
     * The array contains all xhr meta returned in this session
     * with the 0 index being the first call.
     * @method getServiceMeta
     * @return {Array} array of metadata returned by each service call
     */
    getServiceMeta: function () {
        return this._serviceMeta;
    }
};

module.exports = Fetcher;
