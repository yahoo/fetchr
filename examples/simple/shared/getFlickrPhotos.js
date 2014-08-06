/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
var fetcher = require('./fetcherInstance');
module.exports = function flickrRead (callback) {
    fetcher.read('flickr', {
        method: 'flickr.photos.getRecent',
        per_page: 5
    },
    {
        format: 'json'
    },
    function(err, data) {
        if (err) {
            callback && callback(new Error('failed to fetch data' + err));
        }
        callback && callback(null, data);
    });

};
