const headersService = {
    resource: 'header',

    async read({ req }) {
        if (req.headers['x-fetchr-request'] !== '42') {
            const err = new Error('missing x-fetchr header');
            err.statusCode = 400;
            throw err;
        }
        return {
            data: {
                headers: 'ok',
            },
            meta: {
                headers: {
                    'x-fetchr-response': '42',
                },
            },
        };
    },
};

module.exports = {
    headersService,
};
