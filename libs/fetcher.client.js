/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
/*jslint plusplus:true,nomen:true */
/**
 * Fetcher is a RESTful data store, that implements the CRUD interface.
 *
 * In addition, it allows request consolidation.
 * Because touchdown /_td_api accepts multi-request in one HTTP request, remote store
 * batches requests into one request.
 * @module Fetcher
 */
var REST = require('./util/http.client'),
    debug = require('debug'),
    clientFDebug = debug('client-fetcher'),
    _ = {
        forEach :     require('lodash.foreach'),
        values :      require('lodash.values'),
        some :        require('lodash.some'),
        merge :       require('lodash.merge'),
        isFunction :  require('lodash.isfunction'),
        isArray :     require('lodash.isarray'),
        isObject :    require('lodash.isobject'),
        noop :        require('lodash.noop'),
        pick :        require('lodash.pick')
    },
    CORE_REQUEST_FIELDS = ['resource', 'operation', 'params', 'body'],
    DEFAULT_GUID = 'g0',
    DEFAULT_PATH_PREFIX = '/api',
    // By default, wait for 20ms to trigger sweep of the queue, after an item is added to the queue.
    DEFAULT_BATCH_WINDOW = 20,
    MAX_URI_LEN = 2048,
    OP_READ = 'read',
    NAME = 'clientFetcher';

function parseResponse(response) {
    if (response && response.responseText) {
        try {
            return JSON.parse(response.responseText);
        } catch (e) {
            clientFDebug('json parse failed:' + e, 'error', NAME);
            return null;
        }
    }
    return null;
}

function jsonifyComplexType(value) {
    if (_.isArray(value) || _.isObject(value)) {
        return JSON.stringify(value);
    }
    return value;
}

function constructGroupUri(uri, context) {
    var query = [], final_uri = uri;
    _.forEach(context.context, function (v, k) {
        query.push(k + '=' + encodeURIComponent(v));
    });
    if (query.length > 0) {
        final_uri += '?' + query.sort().join('&');
    }
    return final_uri;
}

/**
 * The queue sweeps and processs items in the queue when there are items in the queue.
 * When a item is pushed into the queue, a timeout is set to guarantee the item will be processd soon.
 * If there are any item in the queue before a item, this item can be processd sooner than its timeout.
 *
 * @class Queue
 * @constructor
 * @param {String} id         ID for the queue.
 * @param {Object} config    The configuration object.
 * @param {Function} sweepFn The function to be called when queue is sweeped.
 * @param {Array} sweepFn.items The current items in the queue.
 * @param {Function} callback The function to be used to process a given item in the queue.
 * @param {Obj} callback.item The obj that was popped from the queue.
 */
function Queue(id, config, sweepFn, callback) {
    this.id = id;
    this.config = config || {};
    this._sweep = sweepFn;
    this._cb = callback;
    this._items = [];
    this._timer = null;
}

/**
 * Global unique id of the queue object.
 * @property id
 * @type String
 */
/**
 * The configuraiton object for this queue.
 * @property config
 * @type Object
 */

Queue.prototype = {
    /**
     * Once an item is pushed to the queue,
     * a timer will be set up immediate to sweep and process the items.  The time of the
     * timeout depends on queue's config (20ms by default).  If it is set to a number <= 0,
     * the queue will be sweeped and processed right away.
     * @method push
     * @param {Object} item   The item object to be pushed to the queue
     * @chainable
     */
    push : function (item) {
        if (!item) {
            return this;
        }

        if (this.config.wait <= 0) {
            // process immediately
            this._cb(item);
            this._items = [];
            return this;
        }

        var self = this;
        this._items.push(item);

        // setup timer
        if (!this._timer) {
            this._timer = setTimeout(function () {
                var items = self._items;
                self._items = [];
                clearTimeout(self._timer);
                self._timer = null;
                items = self._sweep(items);
                _.forEach(items, function (item) {
                    self._cb(item);
                });
            }, this.config.wait);
        }
        return this;
    }
};

/**
 * @module fetcherClientController
 * @param {object} options
 * @param {string} [options.pathPrefix="/api"] The path for XHR requests
 * @param {integer} [options.batchWindow=20] Number of milliseconds to wait to batch requests
 */

module.exports = function fetcherClientController (options) {
    options = options || {};

    /**
     * Requests that are initiated within a time window are batched and sent to td-api xhr endpoint.
     * The received responses are splitted and routed back to the callback function assigned by initiator
     * of each request.
     *
     * All requests go out from this store is via HTTP POST.  Therefore, crumb is required in the context
     * param being passed to each CRUD call.  Typical structore of the context param is:
     * <pre>
     * {
     *   config: {
     *     uri : '/myxhr/_td_api'
     *   },
     *   context: {
     *     crumb : '5YFuDK6R',
     *     lang : 'en-US',
     *     site : 'my',
     *     ...
     *   }
     * }
     * </pre>
     *
     * @class FetcherClient
     * @param {object} options
     * @param {Object} req The request object.  It can contain current-session/context data.
     */

    function Fetcher (req) {
        this.req = req || {};
    }

    Fetcher.pathPrefix = options.pathPrefix || DEFAULT_PATH_PREFIX;
    Fetcher.batchWindow = options.batchWindow || DEFAULT_BATCH_WINDOW;

    Fetcher.prototype = {
        // ------------------------------------------------------------------
        // Data Access Wrapper Methods
        // ------------------------------------------------------------------

        /**
         * create operation (create as in CRUD).
         * @method create
         * @param {String} resource  The resource name
         * @param {Object} params    The parameters identify the resource, and along with information
         *                           carried in query and matrix parameters in typical REST API
         * @param {Object} body      The JSON object that contains the resource data that is being created
         * @param {Object} [context={}] The context object.  It can contain "config" for per-request config data.
         * @param {Function} callback callback convention is the same as Node.js
         * @static
         */
        create: function (resource, params, body, context, callback) {
            this._sync(resource, 'create', params, body, context, callback);
        },

        /**
         * read operation (read as in CRUD).
         * @method read
         * @param {String} resource  The resource name
         * @param {Object} params    The parameters identify the resource, and along with information
         *                           carried in query and matrix parameters in typical REST API
         * @param {Object} [context={}] The context object.  It can contain "config" for per-request config data.
         * @param {Function} callback callback convention is the same as Node.js
         * @static
         */
        read: function (resource, params, context, callback) {
            this._sync(resource, 'read', params, undefined, context, callback);
        },

        /**
         * update operation (update as in CRUD).
         * @method update
         * @param {String} resource  The resource name
         * @param {Object} params    The parameters identify the resource, and along with information
         *                           carried in query and matrix parameters in typical REST API
         * @param {Object} body      The JSON object that contains the resource data that is being updated
         * @param {Object} [context={}] The context object.  It can contain "config" for per-request config data.
         * @param {Function} callback callback convention is the same as Node.js
         * @static
         */
        update: function (resource, params, body, context, callback) {
            this._sync(resource, 'update', params, body, context, callback);
        },

        /**
         * delete operation (delete as in CRUD).
         * @method del
         * @param {String} resource  The resource name
         * @param {Object} params    The parameters identify the resource, and along with information
         *                           carried in query and matrix parameters in typical REST API
         * @param {Object} [context={}] The context object.  It can contain "config" for per-request config data.
         * @param {Function} callback callback convention is the same as Node.js
         * @static
         */
        del: function (resource, params, context, callback) {
            this._sync(resource, 'delete', params, undefined, context, callback);
        },

        /**
         * Sync data with remote API.
         * @method _sync
         * @param {String} resource  The resource name
         * @param {String} operation The CRUD operation name: 'create|read|update|delete'.
         * @param {Object} params    The parameters identify the resource, and along with information
         *                           carried in query and matrix parameters in typical REST API
         * @param {Object} body      The JSON object that contains the resource data that is being updated. Not used
         *                           for read and delete operations.
         * @param {Object} [context={}] The context object.  It can contain "config" for per-request config data.
         * @param {Function} callback callback convention is the same as Node.js
         * @static
         * @private
         */
        _sync: function (resource, operation, params, body, context, callback) {
            if (_.isFunction(context)) {
                callback = context;
                context = {};
            }
            context = context || {};
            context.config = {};
            context.config.xhr = Fetcher.pathPrefix;

            var self = this,
                request = {
                    resource: resource,
                    operation: operation,
                    params: params,
                    body: body,
                    context: context,
                    callback: callback
                };

            if (!_.isFunction(this.batch) || (context.config && context.config.consolidate === false)) {
                this.single(request);
                return;
            }

            // push request to queue so that it can be batched
            if (!this._q) {
                this._q = new Queue(this.name, {
                    wait: Fetcher.batchWindow
                }, function (requests) {
                    return self.batch(requests);
                }, function (batched) {
                    if (!batched) {
                        return;
                    }
                    if (!_.isArray(batched)) {
                        self.single(batched);
                    } else {
                        self.multi(batched);
                    }
                });
            }
            this._q.push(request);
        },

        /**
         * @method _constructGetUri
         * @private
         */
        _constructGetUri: function (uri, resource, params, context) {
            var query = [], matrix = [], id_param = context.config.id_param, id_val, final_uri = uri + '/resource/' + resource;
            _.forEach(params, function (v, k) {
                if (k === id_param) {
                    id_val = encodeURIComponent(v);
                } else {
                    try {
                        matrix.push(k + '=' + encodeURIComponent(jsonifyComplexType(v)));
                    } catch (err) {
                        clientFDebug('jsonifyComplexType failed: ' + err, 'info', NAME);
                    }
                }
            });
            _.forEach(context.context, function (v, k) {
                // do not include crumb key, if crumb_for_get is false
                if (k !== 'crumb' || context.config.crumbForGET) {
                    query.push(k + '=' + encodeURIComponent(jsonifyComplexType(v)));
                }
            });
            if (id_val) {
                final_uri += '/' + id_param + '/' + id_val;
            }
            if (matrix.length > 0) {
                final_uri += ';' + matrix.sort().join(';');
            }
            if (query.length > 0) {
                final_uri += '?' + query.sort().join('&');
            }
            return final_uri;
        },

        // ------------------------------------------------------------------
        // Actual Data Access Methods
        // ------------------------------------------------------------------

        /**
         * Execute a single request.
         * @method single
         * @param {Object} request
         * @param {String} request.resource  The resource name
         * @param {String} request.operation The CRUD operation name: 'create|read|update|delete'.
         * @param {Object} request.params    The parameters identify the resource, and along with information
         *                           carried in query and matrix parameters in typical REST API
         * @param {Object} request.body      The JSON object that contains the resource data that is being updated. Not used
         *                           for read and delete operations.
         * @param {Object} request.context The context object.  It can contain "config" for per-request config data.
         * @param {Function} request.callback callback convention is the same as Node.js
         * @protected
         * @static
         */
        single : function (request) {
            if (!request) {
                return;
            }

            var context = request.context,
                callback = request.callback || _.noop,
                use_post,
                allow_retry_post,
                uri = (context.config && (context.config.uri || context.config.xhr)) || Fetcher.pathPrefix,
                get_uri,
                requests,
                data;

            if (OP_READ !== request.operation && (!context.context || !context.context.crumb)) {
                return callback({statusCode: 400, statusText: 'missing crumb'});
            }

            use_post = request.operation !== OP_READ || (context.config && context.config.post_for_read);
            if (!use_post) {
                get_uri = this._constructGetUri(uri, request.resource, request.params, context);
                if (get_uri.length <= MAX_URI_LEN) {
                    uri = get_uri;
                } else {
                    use_post = true;
                }
            }

            if (!use_post) {
                REST.get(uri, {}, context.config, function (err, response) {
                    if (err) {
                        clientFDebug('Syncing ' + request.resource + ' failed: statusCode=' + err.statusCode, 'info', NAME);
                        return callback(err);
                    }
                    callback(null, parseResponse(response));
                });
                return;
            }

            // individual request is also normalized into a request hash to pass to touchdown api
            requests = {};
            requests[DEFAULT_GUID] = _.pick(request, CORE_REQUEST_FIELDS);
            if (!request.body) {
                delete requests[DEFAULT_GUID].body;
            }
            data = {
                requests: requests,
                context: context
            }; // TODO: remove. leave here for now for backward compatibility
            uri = constructGroupUri(uri, context);
            allow_retry_post = (request.operation === OP_READ);
            REST.post(uri, {}, data, _.merge({unsafeAllowRetry: allow_retry_post}, context.config), function (err, response) {
                if (err) {
                    clientFDebug('Syncing ' + request.resource + ' failed: statusCode=' + err.statusCode, 'info', NAME);
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
        },

        /**
         * batch the requests.
         * @method batch
         * @param {Array} Array of requests objects to be batched. Each request is an object with properties:
         *                             `resource`, `operation, `params`, `body`, `context`, `callback`.
         * @return {Array} the request batches.
         * @protected
         * @static
         */
        batch : function (requests) {
            if (!_.isArray(requests) || requests.length <= 1) {
                return requests;
            }

            var batched,
                groups = {};

            _.forEach(requests, function (request) {
                var uri, batch, group_id;
                if (request.context && request.context.config) {
                    uri = request.context.config.uri || request.context.config.xhr || '';
                    batch = request.context.config.batch;
                }
                group_id = 'uri:' + uri;
                if (batch) {
                    group_id += ';batch:' + batch;
                }
                if (!groups[group_id]) {
                    groups[group_id] = [];
                }
                groups[group_id].push(request);
            });
            batched = _.values(groups);

            if (batched.length < requests.length) {
                clientFDebug(requests.length + ' requests batched into ' + batched.length, 'info', NAME);
            }
            return batched;
        },

        /**
         * Execute multiple requests that have been batched together.
         * @method single
         * @param {Array} requests  The request batch.  Each item in this array is a request object with properties:
         *                             `resource`, `operation, `params`, `body`, `context`, `callback`.
         * @protected
         * @static
         */
        multi : function (requests) {
            var uri,
                data,
                count = 0,
                context,
                allow_retry_post = true,
                request_map = {};

            _.some(requests, function (request) {
                if (request.context && request.context.context && request.context.context.crumb) {
                    context = request.context;
                    return true;
                }
                return false;
            }, this);

            if (!context || !context.context.crumb) {
                _.forEach(requests, function (request) {
                    request.callback({statusCode: 400, statusText: 'missing crumb'});
                });
                return;
            }

            uri = (context.config && (context.config.uri || context.config.xhr)) || Fetcher.pathPrefix;

            data = {
                requests: {},
                context: context.context
            }; // TODO: remove. leave here for now for backward compatibility

            _.forEach(requests, function (request) {
                var guid = 'g' + (count++);
                data.requests[guid] = _.pick(request, CORE_REQUEST_FIELDS);
                request_map[guid] = request;
                if (request.operation !== OP_READ) {
                    allow_retry_post = false;
                }
            });

            uri = constructGroupUri(uri, context);
            REST.post(uri, {}, data, _.merge({unsafeAllowRetry: allow_retry_post}, context.config), function (err, response) {
                if (err) {
                    _.forEach(requests, function (request) {
                        request.callback(err);
                    });
                    return;
                }
                var result = parseResponse(response);
                // split result for requests, so that each request gets back only the data that was originally requested
                _.forEach(request_map, function (request, guid) {
                    var res = (result && result[guid]) || {};
                    if (request.callback) {
                        request.callback(res.err || null, res.data || null);
                    }
                });
            });
        }
    };

    return Fetcher;
};
