/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/**
 * @module rest-http
 */

function normalizeHeaders(options) {
    var headers = Object.assign({}, options.headers);

    if (!options.config.cors) {
        headers['X-Requested-With'] = 'XMLHttpRequest';
    }

    if (options.method === 'POST') {
        headers['Content-Type'] = 'application/json';
    }

    return headers;
}

function normalizeRetry(options) {
    var retry = {
        interval: 200,
        maxRetries: 0,
        retryOnPost: false,
        statusCodes: [0, 408, 999],
    };

    if (!options.config.retry) {
        return retry;
    }

    if (options.config.unsafeAllowRetry) {
        retry.retryOnPost = true;
    }

    Object.assign(retry, options.config.retry);

    if (retry.max_retries) {
        console.warn(
            '"max_retries" is deprecated and will be removed in a future release, use "maxRetries" instead.'
        );
        retry.maxRetries = retry.max_retries;
    }

    return retry;
}

function normalizeOptions(options) {
    return {
        credentials: options.config.withCredentials ? 'include' : 'same-origin',
        body: options.data != null ? JSON.stringify(options.data) : undefined,
        headers: normalizeHeaders(options),
        method: options.method,
        retry: normalizeRetry(options),
        timeout: options.config.timeout || options.config.xhrTimeout,
        url: options.url,
    };
}

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

function shouldRetry(options, statusCode, attempt) {
    if (attempt >= options.retry.maxRetries) {
        return false;
    }

    if (options.method === 'POST' && !options.retry.retryOnPost) {
        return false;
    }

    return options.retry.statusCodes.indexOf(statusCode) !== -1;
}

function delayPromise(fn, delay) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            fn().then(resolve, reject);
        }, delay);
    });
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
        body: options.body,
        credentials: options.credentials,
        headers: options.headers,
        method: options.method,
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

function httpRequest(rawOptions, attempt) {
    var controller = new AbortController();
    var currentAttempt = attempt || 0;
    var options = normalizeOptions(rawOptions);

    var promise = io({
        body: options.body,
        controller: controller,
        credentials: options.credentials,
        headers: options.headers,
        method: options.method,
        timeout: options.timeout,
        url: options.url,
    }).catch(function (err) {
        if (!shouldRetry(options, err.statusCode, currentAttempt)) {
            throw err;
        }

        // Use exponential backoff and full jitter
        // strategy published in
        // https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
        var delay =
            Math.random() *
            options.retry.interval *
            Math.pow(2, currentAttempt);

        return delayPromise(function () {
            return httpRequest(rawOptions, currentAttempt + 1);
        }, delay);
    });

    return {
        then: promise.then.bind(promise),
        catch: promise.catch.bind(promise),
        abort: controller.abort.bind(controller),
    };
}

module.exports.default = httpRequest;
