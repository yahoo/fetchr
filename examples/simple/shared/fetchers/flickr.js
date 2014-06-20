/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
var request = require('superagent'),
    flickr_api_key = '7debd4efa50e751b97e1b34b78c14231',
    flickr_api_root = 'https://api.flickr.com/services/rest/',
    querystring = require('querystring'),
    FlickrFetcher;

FlickrFetcher = {
    name: 'flickr',
    //At least one of the CRUD methods is Required
    read: function(resource, params, context, callback) {
        var paramsObj = {
                api_key: flickr_api_key,
                method: params.method || 'flickr.photos.getRecent',
                per_page: parseInt(params.per_page, 10) || 10,
                format: context.format || 'json',
                nojsoncallback: context.nojsoncallback || 1
            },
            url = flickr_api_root + '?' + querystring.stringify(paramsObj);

        request
        .get(url)
        .end(function(err, res) {
            callback(err, JSON.parse(res.text));
        });
    }
    //TODO: other methods
    //create: function(resource, params, body, context, callback) {},
    //update: function(resource, params, body, context, callback) {},
    //del: function(resource, params, context, callback) {}

};

module.exports = FlickrFetcher;
