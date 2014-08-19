var fetchr = require('../../../index'),
    Fetcher = fetchr({
        pathPrefix: '/myapi'
    }),
    flickrFetcher = require('./fetchers/flickr');

Fetcher.addFetcher(flickrFetcher);

module.exports = Fetcher;
