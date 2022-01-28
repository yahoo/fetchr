// This resource allows us to exercise timeout and abort capacities of
// the fetchr client.

const alwaysSlowService = {
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
    alwaysSlowService,
};
