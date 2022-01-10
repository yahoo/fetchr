/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/*jslint plusplus:true,nomen:true */

/**
 * Fetcher is a CRUD interface for your data.
 * @module Fetcher
 */
var httpRequest = require('./util/http.client').default;
var normalizeOptions = require('./util/normalizeOptions');

var DEFAULT_PATH = '/api';
var DEFAULT_TIMEOUT = 3000;
var OP_READ = 'read';

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
function Request(operation, resource, options) {
    if (!resource) {
        throw new Error('Resource is required for a fetcher request');
    }

    this.operation = operation || OP_READ;
    this.resource = resource;
    this.options = options;

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
            time: Date.now() - self._startTime,
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
    var request = httpRequest(normalizeOptions(self));

    if (callback) {
        request.then(
            function (result) {
                self._captureMetaAndStats(null, result);
                setTimeout(function () {
                    callback(
                        null,
                        result && result.data,
                        result && result.meta
                    );
                });
            },
            function (err) {
                self._captureMetaAndStats(err);
                setTimeout(function () {
                    callback(err);
                });
            }
        );
        return request;
    }

    return request.then(
        function (result) {
            self._captureMetaAndStats(null, result);
            return result;
        },
        function (err) {
            self._captureMetaAndStats(err);
            throw err;
        }
    );
};

/**
 * Fetcher class for the client. Provides CRUD methods.
 * @class FetcherClient
 * @param {Object} options configuration options for Fetcher
 * @param {String} [options.xhrPath="/api"] The path for requests
 * @param {Number} [options.xhrTimout=3000] Timeout in milliseconds for all requests
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

function Fetcher(options) {
    this._serviceMeta = [];
    this.options = {
        headers: options.headers,
        xhrPath: options.xhrPath || DEFAULT_PATH,
        xhrTimeout: options.xhrTimeout || DEFAULT_TIMEOUT,
        corsPath: options.corsPath,
        context: options.context || {},
        contextPicker: options.contextPicker || {},
        statsCollector: options.statsCollector,
        _serviceMeta: this._serviceMeta,
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
        return request.params(params).clientConfig(clientConfig).end(callback);
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
    delete: function (resource, params, clientConfig, callback) {
        var request = new Request('delete', resource, this.options);
        if (1 === arguments.length) {
            return request;
        }
        // TODO: Remove below this line in release after next
        if (typeof clientConfig === 'function') {
            callback = clientConfig;
            clientConfig = {};
        }
        return request.params(params).clientConfig(clientConfig).end(callback);
    },

    /**
     * Update options
     * @method updateOptions
     */
    updateOptions: function (options) {
        var self = this;
        var contextPicker = {};
        if (this.options.contextPicker && options.contextPicker) {
            ['GET', 'POST'].forEach(function (method) {
                var oldPicker = self.options.contextPicker[method];
                var newPicker = options.contextPicker[method];

                if (Array.isArray(oldPicker) && Array.isArray(newPicker)) {
                    contextPicker[method] = [].concat(oldPicker, newPicker);
                } else if (oldPicker || newPicker) {
                    var picker = newPicker || oldPicker;
                    contextPicker[method] = Array.isArray(picker)
                        ? [].concat(picker)
                        : picker;
                }
            });
        } else {
            contextPicker = Object.assign(
                {},
                this.options.contextPicker,
                options.contextPicker
            );
        }

        this.options = Object.assign({}, this.options, options, {
            context: Object.assign({}, this.options.context, options.context),
            contextPicker: contextPicker,
            headers: Object.assign({}, this.options.headers, options.headers),
        });
    },

    /**
     * get the serviceMeta array.
     * The array contains all requests meta returned in this session
     * with the 0 index being the first call.
     * @method getServiceMeta
     * @return {Array} array of metadata returned by each service call
     */
    getServiceMeta: function () {
        return this._serviceMeta;
    },
};

module.exports = Fetcher;
