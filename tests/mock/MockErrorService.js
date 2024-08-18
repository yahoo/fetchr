/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
var MockErrorService = {
    resource: 'mock_error_service',

    read: async function ({ req, params }) {
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
            err: {
                statusCode: parseInt(params.statusCode),
                output: params.output,
                message: params.message,
                read: 'error',
            },
            data: null,
            meta,
        };
    },

    create: async function ({ params }) {
        const meta = this.meta || params.meta;
        this.meta = null;

        return {
            err: {
                statusCode: parseInt(params.statusCode),
                message: params.message,
                output: params.output,
                create: 'error',
            },
            data: null,
            meta,
        };
    },

    update: async function ({ params }) {
        return {
            err: {
                statusCode: parseInt(params.statusCode),
                message: params.message,
                output: params.output,
                update: 'error',
            },
            data: null,
        };
    },

    delete: async function ({ params }) {
        return {
            err: {
                statusCode: parseInt(params.statusCode),
                message: params.message,
                output: params.output,
                delete: 'error',
            },
            data: null,
        };
    },
};

module.exports = MockErrorService;
