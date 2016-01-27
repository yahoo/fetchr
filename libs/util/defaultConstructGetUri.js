/**
 * Copyright 2015, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
'use strict';

var debug = require('debug')('Fetcher:defaultConstructGetUri');
var lodash = {
    forEach: require('lodash/forEach'),
    isArray: require('lodash/isArray'),
    isObject: require('lodash/isObject')
};

function jsonifyComplexType(value) {
    if (lodash.isArray(value) || lodash.isObject(value)) {
        return JSON.stringify(value);
    }
    return value;
}

/**
 * Construct xhr GET URI.
 * @method defaultConstructGetUri
 * @param {String} uri base URI
 * @param {String} resource Resource name
 * @param {Object} params Parameters to be serialized
 * @param {Object} config Configuration object
 * @param {String} config.id_param  Name of the id parameter
 * @param {Object} context Context object, which will become query params
 */
module.exports = function defaultConstructGetUri(baseUri, resource, params, config, context) {
    var query = [];
    var matrix = [];
    var id_param = config.id_param;
    var id_val;
    var final_uri = baseUri + '/' + resource;

    if (params) {
        lodash.forEach(params, function eachParam(v, k) {
            if (k === id_param) {
                id_val = encodeURIComponent(v);
            } else if (v !== undefined) {
                try {
                    matrix.push(k + '=' + encodeURIComponent(jsonifyComplexType(v)));
                } catch (err) {
                    debug('jsonifyComplexType failed: ' + err);
                }
            }
        });
    }

    if (context) {
        lodash.forEach(context, function eachContext(v, k) {
            query.push(k + '=' + encodeURIComponent(jsonifyComplexType(v)));
        });
    }

    if (id_val) {
        final_uri += '/' + id_param + '/' + id_val;
    }
    if (matrix.length > 0) {
        final_uri += ';' + matrix.sort().join(';');
    }
    if (query.length > 0) {
        final_uri += '?' + query.sort().join('&');
    }
    debug('constructed get uri:', final_uri);
    return final_uri;
};
