const retryToggle = { error: true };

const errorsService = {
    resource: 'error',
    read(req, resource, params, config, callback) {
        if (params.error === 'unexpected') {
            throw new Error('unexpected');
        }

        if (params.error === 'timeout') {
            setTimeout(() => {
                callback(null, { ok: true });
            }, 100);
            return;
        }

        if (params.error === 'retry') {
            if (retryToggle.error) {
                retryToggle.error = false;
                const err = new Error('retry');
                err.statusCode = 408;
                callback(err);
            } else {
                callback(null, { retry: 'ok' });
            }
            return;
        }

        const err = new Error('error');
        err.statusCode = 400;
        callback(err, null, { foo: 'bar' });
    },
};

module.exports = {
    retryToggle,
    errorsService,
};
