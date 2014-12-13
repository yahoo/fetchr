/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
/*jslint nomen:true,plusplus:true*/
/**
 * @module rest-http
 */

/*
 * Default configurations:
 *   timeout: timeout (in ms) for each request
 *   retry: retry related settings, such as retry interval amount (in ms), max_retries.
 *          Note that only retry only applies on GET.
 */
var _ = require('lodash'),
    DEFAULT_CONFIG = {
        timeout: 3000,
        retry: {
            interval: 200,
            max_retries: 2
        }
    },
    CONTENT_TYPE = 'Content-Type',
    TYPE_JSON = 'application/json',
    TIMEOUT = 'timeout',
    METHOD_GET = 'GET',
    METHOD_PUT = 'PUT',
    METHOD_POST = 'POST',
    METHOD_DELETE = 'DELETE',
    NULL = null,
    xhr = require('xhr');

//trim polyfill, maybe pull from npm later
if (!String.prototype.trim) {
  String.prototype.trim = function () {
    return this.replace(/^\s+|\s+$/g, '');
  };
}

function normalizeHeaders(headers) {
    var normalized = {};
    _.forEach(headers, function (v, field) {
        if (field.toLowerCase() === 'content-type') {
            normalized[CONTENT_TYPE] = v;
        } else {
            normalized[field] = v;
        }
    });
    return normalized;
}

function isContentTypeJSON(headers) {
    return _.some(headers[CONTENT_TYPE].split(';'), function (part) {
        return part.trim().toLowerCase() === TYPE_JSON;
    });
}

function shouldRetry(method, config, statusCode) {
    var isIdempotent = (method === METHOD_GET || method === METHOD_PUT || method === METHOD_DELETE);
    if (!isIdempotent && !config.unsafeAllowRetry) {
        return false;
    }
    if ((statusCode !== 408 && statusCode !== 999) || config.tmp.retry_counter >= config.retry.max_retries) {
        return false;
    }
    config.tmp.retry_counter++;
    config.retry.interval =  config.retry.interval * 2;
    return true;
}

function processErrorResponse(response) {
    // Based on YUI doc, response is supposed to be an object, containing at least status and statusText
    // In case it is not, log the error as status code 999, and which will be a special status code
    // that allows retry (other than 408)
    response = response || {status: 999, statusText: 'null response'};
    if (response.status === 0 && response.statusText === TIMEOUT) {
        // client side JS canceled the XHR
        response.status = 408;
        response.timeoutBy = 'client';
    }
    return response;
}

function createErrorObj(response, timeout) {
    // caller already makes sure response is not undefined
    var errObj = {
        statusCode: response.status,
        statusText: response.statusText,
        responseText: response.responseText
    };
    if (errObj.statusCode === 408) {
        errObj.timeoutBy = response.timeoutBy || '';
        errObj.timeout = timeout || '';
    }
    return errObj;
}

function mergeConfig(config) {
    var cfg = {
            timeout: DEFAULT_CONFIG.timeout,
            unsafeAllowRetry: config.unsafeAllowRetry || false,
            retry: {
                interval: DEFAULT_CONFIG.retry.interval,
                max_retries: DEFAULT_CONFIG.retry.max_retries
            }
        }, // Performant-but-verbose way of cloning the default config as base
        timeout,
        interval,
        maxRetries;

    if (config) {
        timeout = parseInt(config.timeout, 10);
        if (_.isNumber(timeout) && timeout > 0) {
            cfg.timeout = timeout;
        }

        if (config.retry) {
            interval = parseInt(config.retry && config.retry.interval, 10);
            if (_.isNumber(interval) && interval > 0) {
                cfg.retry.interval = interval;
            }
            maxRetries = parseInt(config.retry && config.retry.max_retries, 10);
            if (_.isNumber(maxRetries) && maxRetries >= 0) {
                cfg.retry.max_retries = maxRetries;
            }
        }

        // tmp stores transient state data, such as retry count
        if (config.tmp) {
            cfg.tmp = config.tmp;
        }
    }

    return cfg;
}

function doXhr(method, url, headers, data, config, callback) {
    var options, timeout;

    config = mergeConfig(config);
    headers = normalizeHeaders(headers);
    headers[CONTENT_TYPE] = headers[CONTENT_TYPE] || TYPE_JSON;
    // use config.tmp to store temporary values
    config.tmp = config.tmp || {retry_counter: 0};

    timeout = config.timeout;
    options = {
        method : method,
        timeout : timeout,
        headers: headers,
        on : {
            success : function (id, response) {
                callback(NULL, response);
            },
            failure : function (id, response) {
                response = processErrorResponse(response);
                if (!shouldRetry(method, config, response.status)) {
                    callback(createErrorObj(response, timeout));
                } else {
                    _.delay(
                        function retryXHR() { xhr(method, url, headers, data, config, callback); },
                        config.retry.interval
                    );
                }
            }
        }
    };
    if (data !== undefined && data !== NULL) {
        options.data = isContentTypeJSON(headers) ? JSON.stringify(data) : data;
    }
    io(url, options);
}

function io(url, options) {
    xhr({
        url: url,
        method: options.method || METHOD_GET,
        timeout: options.timeout,
        headers: options.headers,
        body: options.data
    }, function (err, r) {
        if (err) {
            options.on.failure.call(r, null, r);
        } else {
            options.on.success.call(r, null, r);
        }

    });
}

/**
 * @class REST.HTTP
 */
module.exports = {
    /**
     * @method get
     * @public
     * @param {String} url
     * @param {Object} headers
     * @param {Object} config  The config object.
     * @param {Number} [config.timeout=3000] Timeout (in ms) for each request
     * @param {Object} config.retry   Retry config object.
     * @param {Number} [config.retry.interval=200]  The start interval unit (in ms).
     * @param {Number} [config.retry.max_retries=2]   Nmber of max retries.
     * @param {Function} callback The callback funciton, with two params (error, response)
     */
    get : function (url, headers, config, callback) {
        doXhr(METHOD_GET, url, headers, NULL, config, callback);
    },

    /**
     * @method put
     * @param {String} url
     * @param {Object} headers
     * @param {Mixed}  data
     * @param {Object} config  The config object. No retries for PUT.
     * @param {Number} [config.timeout=3000] Timeout (in ms) for each request
     * @param {Number} [config.retry.interval=200]  The start interval unit (in ms).
     * @param {Number} [config.retry.max_retries=2]   Nmber of max retries.
     * @param {Function} callback The callback funciton, with two params (error, response)
     */
    put : function (url, headers, data, config, callback) {
        doXhr(METHOD_PUT, url, headers, data, config, callback);
    },

    /**
     * @method post
     * @param {String} url
     * @param {Object} headers
     * @param {Mixed}  data
     * @param {Object} config  The config object. No retries for POST.
     * @param {Number} [config.timeout=3000] Timeout (in ms) for each request
     * @param {Boolean} [config.unsafeAllowRetry=false] Whether to allow retrying this post.
     * @param {Number} [config.retry.interval=200]  The start interval unit (in ms).
     * @param {Number} [config.retry.max_retries=2]   Nmber of max retries.
     * @param {Function} callback The callback funciton, with two params (error, response)
     */
    post : function (url, headers, data, config, callback) {
        doXhr(METHOD_POST, url, headers, data, config, callback);
    },

    /**
     * @method delete
     * @param {String} url
     * @param {Object} headers
     * @param {Object} config  The config object. No retries for DELETE.
     * @param {Number} [config.timeout=3000] Timeout (in ms) for each request
     * @param {Number} [config.retry.interval=200]  The start interval unit (in ms).
     * @param {Number} [config.retry.max_retries=2]   Nmber of max retries.
     * @param {Function} callback The callback funciton, with two params (error, response)
     */
    'delete' : function (url, headers, config, callback) {
        doXhr(METHOD_DELETE, url, headers, NULL, config, callback);
    }
};
