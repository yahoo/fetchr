const wait = require('./wait');

// This resource allows us to exercise timeout and abort capacities of
// the fetchr client.

const alwaysSlowService = {
    resource: 'slow',
    async read() {
        await wait(5000);
        return { data: { ok: true } };
    },
    async create() {
        await wait(5000);
        return { data: { ok: true } };
    },
};

module.exports = {
    alwaysSlowService,
};
