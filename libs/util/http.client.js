/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/**
 * @module rest-http
 */

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
    METHOD_GET = 'GET',
    METHOD_POST = 'POST';

function parseResponse(response) {
    if (response) {
        try {
            return JSON.parse(response);
        } catch (e) {
            return null;
        }
    }
    return null;
}

function normalizeHeaders(rawHeaders, method, isCors) {
    var headers = Object.assign({}, rawHeaders);

    if (!isCors) {
        headers['X-Requested-With'] = 'XMLHttpRequest';
    }

    if (method === METHOD_POST) {
        headers['Content-Type'] = 'application/json';
    }

    return headers;
}

function shouldRetry(method, config, statusCode, attempt) {
    if (attempt >= config.retry.maxRetries) {
        return false;
    }

    if (method === METHOD_POST && !config.unsafeAllowRetry) {
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

function delayPromise(fn, delay) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            fn().then(resolve, reject);
        }, delay);
    });
}

function doRequest(method, url, headers, data, config, attempt) {
    var controller = new AbortController();
    var currentAttempt = attempt || 0;
    headers = normalizeHeaders(headers, method, config.cors);
    config = mergeConfig(config);

    var promise = io({
        controller: controller,
        url: url,
        method: method,
        timeout: config.timeout,
        headers: headers,
        withCredentials: config.withCredentials,
        data: data !== null ? JSON.stringify(data) : undefined,
    }).catch(function (err) {
        if (!shouldRetry(method, config, err.statusCode, currentAttempt)) {
            throw err;
        }

        // Use exponential backoff and full jitter
        // strategy published in
        // https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
        var delay =
            Math.random() * config.retry.interval * Math.pow(2, currentAttempt);

        return delayPromise(function () {
            return doRequest(
                method,
                url,
                headers,
                data,
                config,
                currentAttempt + 1
            );
        }, delay);
    });

    return {
        then: promise.then.bind(promise),
        catch: promise.catch.bind(promise),
        abort: controller.abort.bind(controller),
    };
}

function FetchrError(options, request, response, responseBody, originalError) {
    var err = originalError;
    var status = response ? response.status : 0;
    var errMessage, errBody;

    if (!err && (status === 0 || (status >= 400 && status < 600))) {
        if (typeof responseBody === 'string') {
            try {
                errBody = JSON.parse(responseBody);
                if (errBody.message) {
                    errMessage = errBody.message;
                } else {
                    errMessage = responseBody;
                }
            } catch (e) {
                errMessage = responseBody;
            }
        } else {
            errMessage = status
                ? 'Error ' + status
                : 'Internal Fetchr XMLHttpRequest Error';
        }

        err = new Error(errMessage);
        err.body = errBody || responseBody;
        if (err.body) {
            err.output = err.body.output;
            err.meta = err.body.meta;
        }
    }

    err.rawRequest = {
        headers: options.headers,
        method: request.method,
        url: request.url,
    };
    err.statusCode = status;
    err.timeout = options.timeout;
    err.url = request.url;

    return err;
}

function io(options) {
    var request = new Request(options.url, {
        method: options.method,
        headers: options.headers,
        body: options.data,
        credentials: options.withCredentials ? 'include' : 'same-origin',
        signal: options.controller.signal,
    });

    var timeoutId = setTimeout(function () {
        options.controller.abort();
    }, options.timeout);

    return fetch(request).then(
        function (response) {
            clearTimeout(timeoutId);

            if (response.ok) {
                return response.text().then(function (responseBody) {
                    return parseResponse(responseBody);
                });
            } else {
                return response.text().then(function (responseBody) {
                    throw new FetchrError(
                        options,
                        request,
                        response,
                        responseBody
                    );
                });
            }
        },
        function (err) {
            clearTimeout(timeoutId);
            throw new FetchrError(options, request, null, null, err);
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
     */
    get: function (url, headers, config) {
        return doRequest(METHOD_GET, url, headers, null, config);
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
     */
    post: function (url, headers, data, config) {
        return doRequest(METHOD_POST, url, headers, data, config);
    },
};
