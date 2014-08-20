var fetchr = require('../../../libs/fetcher.js'),
    Fetcher = fetchr({
        pathPrefix: '/myapi'
    });

module.exports = Fetcher;
