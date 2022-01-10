/**
 * Copyright 2015, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
'use strict';

var forEach = require('./forEach');
var pickContext = require('./pickContext');

function isObject(value) {
    var type = typeof value;
    return value != null && (type == 'object' || type == 'function');
}

function jsonifyComplexType(value) {
    if (Array.isArray(value) || isObject(value)) {
        return JSON.stringify(value);
    }
    return value;
}

/**
 * Construct GET URL.
 * @param {String} baseUrl
 * @param {String} resource Resource name
 * @param {Object} params Parameters to be serialized
 * @param {Object} config Configuration object
 * @param {String} config.id_param  Name of the id parameter
 * @param {Object} context Context object, which will become query params
 */
function buildGETUrl(baseUrl, resource, params, config, context) {
    var query = [];
    var matrix = [];
    var idParam = config.id_param;
    var idVal;
    var finalUrl = baseUrl + '/' + resource;

    if (params) {
        forEach(params, function eachParam(v, k) {
            if (k === idParam) {
                idVal = encodeURIComponent(v);
            } else if (v !== undefined) {
                try {
                    matrix.push(
                        k + '=' + encodeURIComponent(jsonifyComplexType(v))
                    );
                } catch (err) {
                    console.debug('jsonifyComplexType failed: ' + err);
                }
            }
        });
    }

    if (context) {
        forEach(context, function eachContext(v, k) {
            query.push(k + '=' + encodeURIComponent(jsonifyComplexType(v)));
        });
    }

    if (idVal) {
        finalUrl += '/' + idParam + '/' + idVal;
    }
    if (matrix.length > 0) {
        finalUrl += ';' + matrix.sort().join(';');
    }
    if (query.length > 0) {
        finalUrl += '?' + query.sort().join('&');
    }

    return finalUrl;
}

/**
 * Build a final url by adding query params to the base url from
 * request.context
 * @param {String} baseUrl
 * @param {Request} request
 */
function buildPOSTUrl(baseUrl, request) {
    var query = [];
    var finalUrl = baseUrl;

    // We only want to append the resource if the uri is the fetchr
    // one. If users set a custom uri (through clientConfig method or
    // by passing a config obejct to the request), we should not
    // modify it.
    if (!request._clientConfig.uri) {
        finalUrl += '/' + request.resource;
    }

    forEach(
        pickContext(
            request.options.context,
            request.options.contextPicker,
            'POST'
        ),
        function eachContext(v, k) {
            query.push(k + '=' + encodeURIComponent(v));
        }
    );
    if (query.length > 0) {
        finalUrl += '?' + query.sort().join('&');
    }
    return finalUrl;
}

module.exports = {
    buildGETUrl: buildGETUrl,
    buildPOSTUrl: buildPOSTUrl,
};
