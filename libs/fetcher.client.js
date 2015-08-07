/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/*jslint plusplus:true,nomen:true */

/**
 * Fetcher is a CRUD interface for your data.
 * @module Fetcher
 */
var REST = require('./util/http.client');
var debug = require('debug')('FetchrClient');
var lodash = {
        isFunction: require('lodash/lang/isFunction'),
        forEach: require('lodash/collection/forEach'),
        merge: require('lodash/object/merge'),
        noop: require('lodash/utility/noop')
    };
var DEFAULT_GUID = 'g0';
var DEFAULT_XHR_PATH = '/api';
var DEFAULT_XHR_TIMEOUT = 3000;
var MAX_URI_LEN = 2048;
var OP_READ = 'read';
var defaultConstructGetUri = require('./util/defaultConstructGetUri');

function parseResponse(response) {
    if (response && response.responseText) {
        try {
            return JSON.parse(response.responseText);
        } catch (e) {
            debug('json parse failed:' + e, 'error');
            return null;
        }
    }
    return null;
}

/**
 * A RequestClient instance represents a single fetcher request.
 * The constructor requires `operation` (CRUD) and `resource`.
 * @class RequestClient
 * @param {String} operation The CRUD operation name: 'create|read|update|delete'.
 * @param {String} resource name of fetcher/service
 * @param {Object} options configuration options for Request
 * @constructor
 */
function Request (operation, resource, options) {
    if (!resource) {
        throw new Error('Resource is required for a fetcher request');
    }

    this.operation = operation || OP_READ;
    this.resource = resource;
    this.options = {
        xhrPath: options.xhrPath || DEFAULT_XHR_PATH,
        xhrTimeout: options.xhrTimeout || DEFAULT_XHR_TIMEOUT,
        corsPath: options.corsPath,
        context: options.context || {}
    };
    this._params = {};
    this._body = null;
    this._clientConfig = {};
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
 * Execute this fetcher request and call callback.
 * @method end
 * @memberof Request
 * @param {Fetcher~fetcherCallback} callback callback invoked when fetcher/service is complete.
 * @async
 */
Request.prototype.end = function (callback) {
    var clientConfig = this._clientConfig;
    var callback = callback || lodash.noop;
    var use_post;
    var allow_retry_post;
    var uri = clientConfig.uri;
    var requests;
    var params;
    var data;

    if (!uri) {
        uri = clientConfig.cors ? this.options.corsPath : this.options.xhrPath;
    }

    use_post = this.operation !== OP_READ || clientConfig.post_for_read;
    // We use GET request by default for READ operation, but you can override that behavior
    // by specifying {post_for_read: true} in your request's clientConfig
    if (!use_post) {
        var getUriFn = lodash.isFunction(clientConfig.constructGetUri) ? clientConfig.constructGetUri : defaultConstructGetUri;
        var get_uri = getUriFn.call(this, uri, this.resource, this._params, clientConfig, this.options.context);
        /* istanbul ignore next */
        if (!get_uri) {
            // If a custom getUriFn returns falsy value, we should run defaultConstructGetUri
            // TODO: Add test for this fallback
            get_uri = defaultConstructGetUri.call(this, uri, this.resource, this._params, clientConfig, this.options.context);
        }
        if (get_uri.length <= MAX_URI_LEN) {
            uri = get_uri;
        } else {
            use_post = true;
        }
    }

    if (!use_post) {
        return REST.get(uri, {}, lodash.merge({xhrTimeout: this.options.xhrTimeout}, clientConfig), function getDone(err, response) {
            if (err) {
                debug('Syncing ' + this.resource + ' failed: statusCode=' + err.statusCode, 'info');
                return callback(err);
            }
            callback(null, parseResponse(response));
        });
    }

    // individual request is also normalized into a request hash to pass to api
    requests = {};
    requests[DEFAULT_GUID] = {
        resource: this.resource,
        operation: this.operation,
        params: this._params
    };
    if (this._body) {
        requests[DEFAULT_GUID].body = this._body;
    }
    data = {
        requests: requests,
        context: this.options.context
    }; // TODO: remove. leave here for now for backward compatibility
    uri = this._constructGroupUri(uri);
    allow_retry_post = (this.operation === OP_READ);
    REST.post(uri, {}, data, lodash.merge({unsafeAllowRetry: allow_retry_post, xhrTimeout: this.options.xhrTimeout}, clientConfig), function postDone(err, response) {
        if (err) {
            debug('Syncing ' + this.resource + ' failed: statusCode=' + err.statusCode, 'info');
            return callback(err);
        }
        var result = parseResponse(response);
        if (result) {
            result = result[DEFAULT_GUID] || {};
        } else {
            result = {};
        }
        callback(null, result.data);
    });
};

/**
 * Build a final uri by adding query params to base uri from this.context
 * @method _constructGroupUri
 * @param {String} uri the base uri
 * @private
 */
Request.prototype._constructGroupUri = function (uri) {
    var query = [];
    var final_uri = uri;
    lodash.forEach(this.options.context, function eachContext(v, k) {
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
 * @param {object} options configuration options for Fetcher
 * @param {string} [options.xhrPath="/api"] The path for XHR requests
 * @param {number} [options.xhrTimout=3000] Timeout in milliseconds for all XHR requests
 * @param {Boolean} [options.corsPath] Base CORS path in case CORS is enabled
 * @param {Object} [options.context] The context object that is propagated to all outgoing
 *      requests as query params.  It can contain current-session/context data that should
 *      persist to all requests.
 */

function Fetcher (options) {
    this.options = options || {};
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
        request
            .params(params)
            .body(body)
            .clientConfig(clientConfig)
            .end(callback)
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
        request
            .params(params)
            .clientConfig(clientConfig)
            .end(callback)
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
        request
            .params(params)
            .body(body)
            .clientConfig(clientConfig)
            .end(callback)
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
        request
            .params(params)
            .clientConfig(clientConfig)
            .end(callback)
    },

    /**
     * Update options
     * @method updateOptions
     */
    updateOptions: function (options) {
        this.options = lodash.merge(this.options, options);
    }
};

module.exports = Fetcher;
