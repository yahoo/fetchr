const wait = require('./wait');

const retryToggle = { error: true };

const errorsService = {
    resource: 'error',
    async read({ params }) {
        if (params.error === 'unexpected') {
            throw new Error('unexpected');
        }

        if (params.error === 'timeout') {
            await wait(100);
            return { data: { ok: true } };
        }

        if (params.error === 'retry') {
            if (retryToggle.error) {
                retryToggle.error = false;
                const err = new Error('retry');
                err.statusCode = 408;
                throw err;
            }

            return { data: { retry: 'ok' } };
        }

        const err = new Error('error');
        err.statusCode = 400;

        return {
            err,
            meta: {
                foo: 'bar',
            },
        };
    },

    async create({ params }) {
        return this.read({ params });
    },
};

module.exports = {
    retryToggle,
    errorsService,
};
