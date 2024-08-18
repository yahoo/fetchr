/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
var MockService = {
    resource: 'mock_service',

    read: async function ({ req, resource, params }) {
        const meta = this.meta || params.meta;
        this.meta = null;

        if (
            req.query &&
            req.query.cors &&
            params &&
            Object.keys(params).length === 0
        ) {
            // in our CORS test, we use regular query params instead
            // of matrix params for the params object will be empty
            // create params from req.query but omit the context
            // values(i.e. cors)
            params = {};
            for (const [key, value] of Object.entries(req.query)) {
                if (['cors', '_csrf'].includes(key)) {
                    continue;
                }
                params[key] = value;
            }
        }

        return {
            data: {
                operation: {
                    name: 'read',
                    success: true,
                },
                args: {
                    resource: resource,
                    params: params,
                },
            },
            meta,
        };
    },

    create: async function ({ resource, params }) {
        const meta = this.meta || params.meta;
        this.meta = null;

        return {
            data: {
                operation: {
                    name: 'create',
                    success: true,
                },
                args: {
                    resource: resource,
                    params: params,
                },
            },
            err: null,
            meta,
        };
    },

    update: async function ({ resource, params }) {
        const meta = this.meta || params.meta;
        this.meta = null;

        return {
            data: {
                operation: {
                    name: 'update',
                    success: true,
                },
                args: {
                    resource: resource,
                    params: params,
                },
            },
            meta,
        };
    },

    delete: async function ({ resource, params }) {
        const meta = this.meta || params.meta;
        this.meta = null;

        return {
            data: {
                operation: {
                    name: 'delete',
                    success: true,
                },
                args: {
                    resource: resource,
                    params: params,
                },
            },
            meta,
        };
    },
};

module.exports = MockService;
