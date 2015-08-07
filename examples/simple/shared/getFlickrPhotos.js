/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
module.exports = function flickrRead (fetcher, callback) {
    fetcher
        .read('flickr')
        .params({
            method: 'flickr.photos.getRecent',
            per_page: 5
        })
        .end(function(err, data) {
            if (err) {
                callback && callback(new Error('failed to fetch data ' + err.message));
            }
            callback && callback(null, data);
        });

};
