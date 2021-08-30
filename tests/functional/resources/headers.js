const headersService = {
    resource: 'header',

    read(req, resource, params, config, callback) {
        if (req.headers['x-fetchr-request'] !== '42') {
            const err = new Error('missing x-fetchr header');
            err.statusCode = 400;
            callback(err);
            return;
        }
        callback(
            null,
            { headers: 'ok' },
            { headers: { 'x-fetchr-response': '42' } }
        );
    },
};

module.exports = {
    headersService,
};
