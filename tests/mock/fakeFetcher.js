/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
var Fetcher = {
    name: 'fake_fetcher',

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
        callback(null, {
            read: 'success',
            args: {
                resource: resource,
                params: params,
                context: context
            }
        });
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
        callback(null, {
            create: 'success',
            args: {
                resource: resource,
                params: params,
                context: context
            }
        });
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
        callback(null, {
            update: 'success',
            args: {
                resource: resource,
                params: params,
                context: context
            }
        });
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
        callback(null, {
            del: 'success',
            args: {
                resource: resource,
                params: params,
                context: context
            }
        });
    }

};

module.exports = Fetcher;
