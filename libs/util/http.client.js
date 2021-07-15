/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/**
 * @module rest-http
 */

var xhr = require('xhr');
var forEach = require('./forEach');

/*
 * Default configurations:
 *   timeout: timeout (in ms) for each request
 *   retry: retry related settings, such as retry interval amount (in ms), max_retries.
 *          Note that only retry only applies on GET.
 */
var DEFAULT_CONFIG = {
        retry: {
            interval: 200,
            maxRetries: 0,
            statusCodes: [0, 408, 999],
        },
        unsafeAllowRetry: false,
    },
    CONTENT_TYPE = 'Content-Type',
    TYPE_JSON = 'application/json',
    METHOD_GET = 'GET',
    METHOD_PUT = 'PUT',
    METHOD_POST = 'POST',
    METHOD_DELETE = 'DELETE',
    NULL = null;

var INITIAL_ATTEMPT = 0;

//trim polyfill, maybe pull from npm later
if (!String.prototype.trim) {
    String.prototype.trim = function () {
        return this.replace(/^\s+|\s+$/g, '');
    };
}

function normalizeHeaders(headers, method, isCors) {
    var normalized = {};
    if (!isCors) {
        normalized['X-Requested-With'] = 'XMLHttpRequest';
    }
    var needContentType = method === METHOD_PUT || method === METHOD_POST;
    forEach(headers, function (v, field) {
        if (field.toLowerCase() === 'content-type') {
            if (needContentType) {
                normalized[CONTENT_TYPE] = v;
            }
        } else {
            normalized[field] = v;
        }
    });

    if (needContentType && !normalized[CONTENT_TYPE]) {
        normalized[CONTENT_TYPE] = TYPE_JSON;
    }

    return normalized;
}

function isContentTypeJSON(headers) {
    if (!headers[CONTENT_TYPE]) {
        return false;
    }

    return headers[CONTENT_TYPE].split(';').some(function (part) {
        return part.trim().toLowerCase() === TYPE_JSON;
    });
}

function shouldRetry(method, config, statusCode, attempt) {
    if (attempt >= config.retry.maxRetries) {
        return false;
    }

    var isIdempotent =
        method === METHOD_GET ||
        method === METHOD_PUT ||
        method === METHOD_DELETE;
    if (!isIdempotent && !config.unsafeAllowRetry) {
        return false;
    }

    return config.retry.statusCodes.indexOf(statusCode) !== -1;
}

function mergeConfig(config) {
    var cfg = {
        unsafeAllowRetry: config.unsafeAllowRetry || false,
        retry: {
            interval: DEFAULT_CONFIG.retry.interval,
            maxRetries: DEFAULT_CONFIG.retry.maxRetries,
            statusCodes: DEFAULT_CONFIG.retry.statusCodes,
        },
    };

    if (config) {
        var timeout = config.timeout || config.xhrTimeout;
        timeout = parseInt(timeout, 10);
        if (!isNaN(timeout) && timeout > 0) {
            cfg.timeout = timeout;
        }

        if (config.retry) {
            var interval = parseInt(config.retry.interval, 10);
            if (!isNaN(interval) && interval > 0) {
                cfg.retry.interval = interval;
            }

            if (config.retry.max_retries !== undefined) {
                console.warn(
                    '"max_retries" is deprecated and will be removed in a future release, use "maxRetries" instead.'
                );
            }

            var maxRetries = parseInt(
                config.retry.max_retries || config.retry.maxRetries,
                10
            );
            if (!isNaN(maxRetries) && maxRetries >= 0) {
                cfg.retry.maxRetries = maxRetries;
            }

            if (config.retry.statusCodes) {
                cfg.retry.statusCodes = config.retry.statusCodes;
            }
        }

        if (config.withCredentials) {
            cfg.withCredentials = config.withCredentials;
        }
    }

    return cfg;
}

function doXhr(method, url, headers, data, config, attempt, callback) {
    headers = normalizeHeaders(headers, method, config.cors);
    config = mergeConfig(config);

    var options = {
        method: method,
        timeout: config.timeout,
        headers: headers,
        useXDR: config.useXDR,
        withCredentials: config.withCredentials,
        on: {
            success: function (err, response) {
                callback(NULL, response);
            },
            failure: function (err, response) {
                if (
                    !shouldRetry(method, config, response.statusCode, attempt)
                ) {
                    callback(err);
                } else {
                    // Use exponential backoff and full jitter strategy published in https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
                    var delay =
                        Math.random() *
                        config.retry.interval *
                        Math.pow(2, attempt);

                    setTimeout(function retryXHR() {
                        doXhr(
                            method,
                            url,
                            headers,
                            data,
                            config,
                            attempt + 1,
                            callback
                        );
                    }, delay);
                }
            },
        },
    };
    if (data !== undefined && data !== NULL) {
        options.data = isContentTypeJSON(headers) ? JSON.stringify(data) : data;
    }
    return io(url, options);
}

function io(url, options) {
    return xhr(
        {
            url: url,
            method: options.method || METHOD_GET,
            timeout: options.timeout,
            headers: options.headers,
            body: options.data,
            useXDR: options.cors,
            withCredentials: options.withCredentials,
        },
        function (err, resp, body) {
            var status = resp.statusCode;
            var errMessage, errBody;

            if (!err && (status === 0 || (status >= 400 && status < 600))) {
                if (typeof body === 'string') {
                    try {
                        errBody = JSON.parse(body);
                        if (errBody.message) {
                            errMessage = errBody.message;
                        } else {
                            errMessage = body;
                        }
                    } catch (e) {
                        errMessage = body;
                    }
                } else {
                    errMessage = status
                        ? 'Error ' + status
                        : 'Internal Fetchr XMLHttpRequest Error';
                }

                err = new Error(errMessage);
                err.statusCode = status;
                err.body = errBody || body;
                if (err.body) {
                    err.output = err.body.output;
                    err.meta = err.body.meta;
                }
            }

            resp.responseText = body;

            if (err) {
                // getting detail info from xhr module
                err.rawRequest = resp.rawRequest;
                err.url = resp.url;
                err.timeout = options.timeout;

                options.on.failure.call(null, err, resp);
            } else {
                options.on.success.call(null, null, resp);
            }
        }
    );
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
     * @param {Object} config.retry Retry config object.
     * @param {Number} [config.retry.interval=200] The start interval unit (in ms).
     * @param {Number} [config.retry.maxRetries=0] Number of max retries.
     * @param {Number} [config.retry.statusCodes=[0, 408, 999]] Response status codes to be retried.
     * @param {Boolean} [config.cors] Whether to enable CORS & use XDR on IE8/9.
     * @param {Function} callback The callback function, with two params (error, response)
     */
    get: function (url, headers, config, callback) {
        return doXhr(
            METHOD_GET,
            url,
            headers,
            NULL,
            config,
            INITIAL_ATTEMPT,
            callback
        );
    },

    /**
     * @method put
     * @param {String} url
     * @param {Object} headers
     * @param {Mixed}  data
     * @param {Object} config  The config object. No retries for PUT.
     * @param {Number} [config.timeout=3000] Timeout (in ms) for each request
     * @param {Number} [config.retry.interval=200] The start interval unit (in ms).
     * @param {Number} [config.retry.maxRetries=0] Number of max retries.
     * @param {Number} [config.retry.statusCodes=[0, 408, 999]] Response status codes to be retried.
     * @param {Boolean} [config.cors] Whether to enable CORS & use XDR on IE8/9.
     * @param {Function} callback The callback function, with two params (error, response)
     */
    put: function (url, headers, data, config, callback) {
        return doXhr(
            METHOD_PUT,
            url,
            headers,
            data,
            config,
            INITIAL_ATTEMPT,
            callback
        );
    },

    /**
     * @method post
     * @param {String} url
     * @param {Object} headers
     * @param {Mixed}  data
     * @param {Object} config  The config object. No retries for POST.
     * @param {Number} [config.timeout=3000] Timeout (in ms) for each request
     * @param {Boolean} [config.unsafeAllowRetry=false] Whether to allow retrying this post.
     * @param {Number} [config.retry.interval=200] The start interval unit (in ms).
     * @param {Number} [config.retry.maxRetries=0] Number of max retries.
     * @param {Number} [config.retry.statusCodes=[0, 408, 999]] Response status codes to be retried.
     * @param {Boolean} [config.cors] Whether to enable CORS & use XDR on IE8/9.
     * @param {Function} callback The callback function, with two params (error, response)
     */
    post: function (url, headers, data, config, callback) {
        return doXhr(
            METHOD_POST,
            url,
            headers,
            data,
            config,
            INITIAL_ATTEMPT,
            callback
        );
    },

    /**
     * @method delete
     * @param {String} url
     * @param {Object} headers
     * @param {Object} config  The config object. No retries for DELETE.
     * @param {Number} [config.timeout=3000] Timeout (in ms) for each request
     * @param {Number} [config.retry.interval=200] The start interval unit (in ms).
     * @param {Number} [config.retry.maxRetries=0] Number of max retries.
     * @param {Number} [config.retry.statusCodes=[0, 408, 999]] Response status codes to be retried.
     * @param {Boolean} [config.cors] Whether to enable CORS & use XDR on IE8/9.
     * @param {Function} callback The callback function, with two params (error, response)
     */
    delete: function (url, headers, config, callback) {
        return doXhr(
            METHOD_DELETE,
            url,
            headers,
            NULL,
            config,
            INITIAL_ATTEMPT,
            callback
        );
    },
};
