/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/**
 * list of registered fetchers
 */
var OP_READ = 'read';
var OP_CREATE = 'create';
var OP_UPDATE = 'update';
var GET = 'GET';
var qs = require('querystring');
var debug = require('debug')('Fetchr');

function parseValue(value) {
    // take care of value of type: array, object
    try {
        return JSON.parse(value);
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

/*
 * @module createFetcherClass
 * @param {object} options
 */


    /**
     * @class Fetcher
     * @param {Object} options configuration options for Fetcher
     * @param {Object} [options.req] The request object.  It can contain per-request/context data.
     * @param {string} [options.xhrPath="/api"] The path for XHR requests. Will be ignored serverside.
     * @constructor
     */
    function Fetcher(options) {
        this.options = options || {};
        this.req = this.options.req || {};
    }

    Fetcher.fetchers = {};

    /**
     * @method registerFetcher
     * @memberof Fetcher
     * @param {Function} fetcher
     */
    Fetcher.registerFetcher = function (fetcher) {
        var name = fetcher.name || null;
        //Store fetcher by name
        if (!(fetcher && name)) {
            throw new Error('Fetcher is not defined correctly');
        }

        Fetcher.fetchers[name] = fetcher;
        debug('fetcher ' + name + ' added');
        return;
    };

    /**
     * @method getFetcher
     * @memberof Fetcher
     * @param {String} name
     * @returns {Function} fetcher
     */
    Fetcher.getFetcher = function (name) {
        //Access fetcher by name
        if (!name || !Fetcher.fetchers[name]) {
            throw new Error('Fetcher "' + name + '" could not be found');
        }
        return Fetcher.fetchers[name];
    };

    /**
     * @method middleware
     * @memberof Fetcher
     * @returns {Function} middleware
     *     @param {Object} req
     *     @param {Object} res
     *     @param {Object} next
     */
    Fetcher.middleware = function () {
        return function (req, res, next) {
            var request;

            if (req.method === GET) {
                var path = req.path.substr(1).split(';');
                request = {
                    req: req,
                    resource: path.shift(),
                    operation: OP_READ,
                    params: parseParamValues(qs.parse(path.join('&'))),
                    config: {},
                    callback: function (err, data, meta) {
                        meta = meta || {};
                        if (meta.headers) {
                            res.set(meta.headers);
                        }
                        if (err) {
                            res.status(err.statusCode || 400).json({
                                message: err.message || 'request failed'
                            });
                            return;
                        }
                        res.status(meta.statusCode || 200).json(data);
                    }
                };
            } else {
                var requests = req.body.requests;

                if (!requests || Object.keys(requests).length === 0) {
                    res.status(400).end();
                    return;
                }

                var DEFAULT_GUID = 'g0',
                    singleRequest = requests[DEFAULT_GUID];
                request = {
                    req: req,
                    resource: singleRequest.resource,
                    operation: singleRequest.operation,
                    params: singleRequest.params,
                    body: singleRequest.body || {},
                    config: singleRequest.config,
                    callback: function(err, data, meta) {
                        meta = meta || {};
                        if (meta.headers) {
                            res.set(meta.headers);
                        }
                        if(err) {
                            res.status(err.statusCode || 400).json({
                                message: err.message || 'request failed'
                            });
                            return;
                        }
                        var responseObj = {};
                        responseObj[DEFAULT_GUID] = {data: data};
                        res.status(meta.statusCode || 200).json(responseObj);
                    }
                };
            }

            Fetcher.single(request);
            // TODO: Batching and multi requests
        };
    };


    // ------------------------------------------------------------------
    // Data Access Wrapper Methods
    // ------------------------------------------------------------------

    /**
     * Execute a single request.
     * @method single
     * @memberof Fetcher
     * @param {Object} request
     * @param {String} request.req       The req object from express/connect
     * @param {String} request.resource  The resource name
     * @param {String} request.operation The CRUD operation name: 'create|read|update|delete'.
     * @param {Object} request.params    The parameters identify the resource, and along with information
     *                                   carried in query and matrix parameters in typical REST API
     * @param {Object} request.body      The JSON object that contains the resource data that is being updated. Not used
     *                                   for read and delete operations.
     * @param {Object} request.config    The config object.  It can contain "config" for per-request config data.
     * @param {Fetcher~fetcherCallback} request.callback callback invoked when fetcher is complete.
     * @protected
     * @static
     */
    Fetcher.single = function (request) {
        var fetcher = Fetcher.getFetcher(request.resource.split('.')[0]),
            op = request.operation,
            req = request.req,
            resource = request.resource,
            params = request.params,
            body = request.body,
            config = request.config,
            callback = request.callback,
            args;

        if (typeof config === 'function') {
            callback = config;
            config = {};
        }

        args = [req, resource, params, config, callback];

        if ((op === OP_CREATE) || (op === OP_UPDATE)) {
            args.splice(3, 0, body);
        }

        fetcher[op].apply(fetcher, args);
    };


    // ------------------------------------------------------------------
    // CRUD Methods
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
        var request = {
            req: this.req,
            resource: resource,
            operation: 'read',
            params: params,
            config: config,
            callback: callback
        };
        Fetcher.single(request);
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
        var request = {
            req: this.req,
            resource: resource,
            operation: 'create',
            params: params,
            body: body,
            config: config,
            callback: callback
        };
        Fetcher.single(request);
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
        var request = {
            req: this.req,
            resource: resource,
            operation: 'update',
            params: params,
            body: body,
            config: config,
            callback: callback
        };
        Fetcher.single(request);
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
        var request = {
            req: this.req,
            resource: resource,
            operation: 'delete',
            params: params,
            config: config,
            callback: callback
        };
        Fetcher.single(request);
    };

    module.exports = Fetcher;

/**
 * @callback Fetcher~fetcherCallback
 * @param {Object} err  The request error, pass null if there was no error. The data and meta parameters will be ignored if this parameter is not null.
 * @param {number} [err.statusCode=400] http status code to return
 * @param {string} [err.message=request failed] http response body
 * @param {Object} data request result
 * @param {Object} [meta] request meta-data
 * @param {number} [meta.statusCode=200] http status code to return
 */
