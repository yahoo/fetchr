const wait = require('./wait');

// This resource gives 2 slow responses and then a fast one. This is
// so, so we can test that fetchr client is able to retry timed out
// requests.

const state = {
    count: 0,
};

const slowThenFastService = {
    resource: 'slow-then-fast',
    async read({ params }) {
        if (params.reset) {
            state.count = 0;
            return {};
        }

        const timeout = state.count === 2 ? 0 : 5000;
        state.count++;

        await wait(timeout);

        return { data: { attempts: state.count } };
    },
};

module.exports = {
    slowThenFastService,
};
