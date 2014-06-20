/**
 * list of registered fetchers
 */
var fetchersList = {},
    OP_READ = 'read',
    OP_CREATE = 'create',
    OP_UPDATE = 'update',
    GET = 'GET',
    qs = require('querystring'),
    debug = require('debug')('Fetchr:fetchr'),
    defaultPathPrefix = '/api',
    pathPrefix = '';

var Fetcher = {
    /**
     * @method middleware
     * @param {Object} config Configuration object for middleware
     * @returns {Function} middleware
     *     @param {Object} req
     *     @param {Object} res
     *     @param {Object} next
     */
    middleware: function (config) {
        pathPrefix = config.pathPrefix || defaultPathPrefix;
        return function (req, res, next) {
            var request;

            if (req.path.indexOf(pathPrefix) !== 0) {
                //Skip non fetchr requests
                next();
                return;
            }

            if (req.method === GET) {
                var defaultPath = pathPrefix + '/resource/',
                    path = req.path.substr(defaultPath.length).split(';');
                request = {
                    resource: path.shift(),
                    operation: OP_READ,
                    params: qs.parse(path.join('&')),
                    context: {},
                    callback: function (err, data) {
                        if (err) {
                            res.send('400', 'request failed');
                        }
                        res.json(data);
                    }
                };
            } else {
                var requests = req.body.requests,
                    context = req.body.context;

                if (!requests || requests.length === 0) {
                    res.send(204);
                }

                var DEFAULT_GUID = 'g0',
                    singleRequest = requests[DEFAULT_GUID];
                request = {
                    resource: singleRequest.resource,
                    operation: singleRequest.operation,
                    params: singleRequest.params,
                    body: singleRequest.body || {},
                    context: context,
                    callback: function(err, data) {
                        if(err) {
                            res.send('400', 'request failed');
                        }
                        var responseObj = {};
                        responseObj[DEFAULT_GUID] = {data: data};
                        res.json(responseObj);
                    }
                };
            }

            Fetcher.single(request);
            //TODO: Batching and multi requests
        };
    },
    /**
     * @method getPathPrefix
     * @returns {String} get the path prefix to expose to client fetchr
     */
    getPathPrefix: function () {
        return pathPrefix;
    },
    /**
     * @method addFetcher
     * @param {String} name
     * @param {Function} fetcher
     */
    addFetcher: function (fetcher) {
        var name = fetcher.name || null;
        //Store fetcher by name
        if (!(fetcher && name)) {
            throw new Error('Fetcher is not defined correctly');
        }

        fetchersList[name] = fetcher;
        return;
    },
    /**
     * @method getFetcher
     * @param {String} name
     * @returns {Function} fetcher
     */
    getFetcher: function (name) {
        //Access fetcher by name
        if (!name || !fetchersList[name]) {
            throw new Error('Fetcher could not be found');
        }
        return fetchersList[name];
    },
    /**
     * @method getAllFetchers
     * @param {String} name
     * @returns {Array} array of stored fetchers
     */
    getAllFetchers: function () {
        return fetchersList;
    },
    /**
     * @method resetAllFetchers
     */
    _resetAllFetchers: function () {
        fetchersList = {};
    },

    // ------------------------------------------------------------------
    // Data Access Wrapper Methods
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
    single: function (request) {
        debug(request.resource);
        var store = Fetcher.getFetcher(request.resource.split('.')[0]),
            op = request.operation,
            resource = request.resource,
            params = request.params,
            body = request.body,
            context = request.context,
            callback = request.callback,
            args = [resource, params, context, callback];

        if ((op === OP_CREATE) || (op === OP_UPDATE)) {
            args.splice(2, 0, body);
        }

        store[op].apply(store, args);
    },

    // ------------------------------------------------------------------
    // CRUD Methods
    // ------------------------------------------------------------------

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
        var request = {
            resource: resource,
            operation: 'read',
            params: params,
            context: context,
            callback: callback
        };
        Fetcher.single(request);
    },
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
        var request = {
            resource: resource,
            operation: 'create',
            params: params,
            body: body,
            context: context,
            callback: callback
        };
        Fetcher.single(request);
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
        var request = {
            resource: resource,
            operation: 'update',
            params: params,
            body: body,
            context: context,
            callback: callback
        };
        Fetcher.single(request);
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
        var request = {
            resource: resource,
            operation: 'del',
            params: params,
            context: context,
            callback: callback
        };
        Fetcher.single(request);
    }
};

module.exports = Fetcher;
