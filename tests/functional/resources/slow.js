const slowService = {
    resource: 'slow',
    read(req, resource, params, config, callback) {
        setTimeout(() => {
            callback(null, { ok: true });
        }, 5000);
    },
    create(req, resource, params, body, config, callback) {
        setTimeout(() => {
            callback(null, { ok: true });
        }, 5000);
    },
};

module.exports = {
    slowService,
};
