// This resource gives 2 slow responses and then a fast one. This is
// so, so we can test that fetchr client is able to retry timed out
// requests.

const state = {
    count: 0,
};

const slowThenFastService = {
    resource: 'slow-then-fast',
    read(req, resource, params, config, callback) {
        if (params.reset) {
            state.count = 0;
            callback();
        }

        const timeout = state.count === 2 ? 0 : 5000;
        state.count++;
        setTimeout(() => {
            callback(null, { attempts: state.count });
        }, timeout);
    },
};

module.exports = {
    slowThenFastService,
};
