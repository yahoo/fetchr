var fetcher = require('fetchr');
module.exports = function flickrRead (callback) {
    fetcher.read('flickr', {
        method: 'flickr.photos.getRecent',
        per_page: 5,
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
