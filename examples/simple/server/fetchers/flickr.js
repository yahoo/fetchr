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
    read: function(req, resource, params, config, callback) {
        var paramsObj = {
                api_key: flickr_api_key,
                method: params.method || 'flickr.photos.getRecent',
                per_page: parseInt(params.per_page, 10) || 10,
                format: 'json',
                nojsoncallback: config.nojsoncallback || 1
            },
            url = flickr_api_root + '?' + querystring.stringify(paramsObj);

        request
        .get(url)
        .end(function(err, res) {
            callback(err, JSON.parse(res.text));
        });
    }
    //TODO: other methods
    //create: function(req, resource, params, body, config, callback) {},
    //update: function(req, resource, params, body, config, callback) {},
    //delete: function(req, resource, params, config, callback) {}

};

module.exports = FlickrFetcher;
