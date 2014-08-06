var Fetcher = require('../../../index'),
    fetcher = new Fetcher({
        pathPrefix: '/myapi'
    }),
    flickrFetcher = require('./fetchers/flickr');

fetcher.addFetcher(flickrFetcher);

module.exports = fetcher;
