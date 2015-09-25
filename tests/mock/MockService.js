/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
var debug = require('debug')('mservice');
var MockService = {
    name: 'mock_service',

    // ------------------------------------------------------------------
    // CRUD Methods
    // ------------------------------------------------------------------

    /**
     * read operation (read as in CRUD).
     * @method read
     * @param {Object} req  The request object from connect/express
     * @param {String} resource  The resource name
     * @param {Object} params    The parameters identify the resource, and along with information
     *                           carried in query and matrix parameters in typical REST API
     * @param {Object} [config={}] The config object.  It can contain "config" for per-request config data.
     * @param {Fetcher~fetcherCallback} callback callback invoked when fetcher is complete.
     * @static
     */
    read: function (req, resource, params, config, callback) {
        debug([].splice.call(arguments, 1));
        callback(null, {
            operation: {
                name: 'read',
                success: true
            },
            args: {
                resource: resource,
                params: params
            }
        }, this.meta || params.meta);
        this.meta = null;
    },
    /**
     * create operation (create as in CRUD).
     * @method create
     * @param {Object} req  The request object from connect/express
     * @param {String} resource  The resource name
     * @param {Object} params    The parameters identify the resource, and along with information
     *                           carried in query and matrix parameters in typical REST API
     * @param {Object} body      The JSON object that contains the resource data that is being created
     * @param {Object} [config={}] The config object.  It can contain "config" for per-request config data.
     * @param {Fetcher~fetcherCallback} callback callback invoked when fetcher is complete.
     * @static
     */
    create: function (req, resource, params, body, config, callback) {
        callback(null, {
            operation: {
                name: 'create',
                success: true
            },
            args: {
                resource: resource,
                params: params
            }
        }, this.meta || params.meta);
        this.meta = null;
    },
    /**
     * update operation (update as in CRUD).
     * @method update
     * @param {Object} req  The request object from connect/express
     * @param {String} resource  The resource name
     * @param {Object} params    The parameters identify the resource, and along with information
     *                           carried in query and matrix parameters in typical REST API
     * @param {Object} body      The JSON object that contains the resource data that is being updated
     * @param {Object} [config={}] The config object.  It can contain "config" for per-request config data.
     * @param {Fetcher~fetcherCallback} callback callback invoked when fetcher is complete.
     * @static
     */
    update: function (req, resource, params, body, config, callback) {
        callback(null, {
            operation: {
                name: 'update',
                success: true
            },
            args: {
                resource: resource,
                params: params
            }
        }, this.meta || params.meta);
        this.meta = null;
    },
    /**
     * delete operation (delete as in CRUD).
     * @method delete
     * @param {Object} req  The request object from connect/express
     * @param {String} resource  The resource name
     * @param {Object} params    The parameters identify the resource, and along with information
     *                           carried in query and matrix parameters in typical REST API
     * @param {Object} [config={}] The config object.  It can contain "config" for per-request config data.
     * @param {Fetcher~fetcherCallback} callback callback invoked when fetcher is complete.
     * @static
     */
    'delete': function (req, resource, params, config, callback) {
        callback(null, {
            operation: {
                name: 'delete',
                success: true
            },
            args: {
                resource: resource,
                params: params
            }
        }, this.meta || params.meta);
        this.meta = null;
    }

};

module.exports = MockService;
