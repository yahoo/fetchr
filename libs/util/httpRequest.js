/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/**
 * @module httpRequest
 */

function FetchrError(options, request, response, responseBody, originalError) {
    var err = originalError;
    var status = response ? response.status : 0;
    var errMessage, errBody;

    if (!err) {
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

function io(options, controller) {
    var request = new Request(options.url, {
        body: options.body,
        credentials: options.credentials,
        headers: options.headers,
        method: options.method,
        signal: controller.signal,
    });

    var timeoutId = setTimeout(function () {
        controller.abort();
    }, options.timeout);

    return fetch(request).then(
        function (response) {
            clearTimeout(timeoutId);

            if (response.ok) {
                return response.json().catch(function () {
                    return null;
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

function httpRequest(options, attempt) {
    var controller = new AbortController();
    var currentAttempt = attempt || 0;

    var promise = io(options, controller).catch(function (err) {
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
            return httpRequest(options, currentAttempt + 1);
        }, delay);
    });

    return {
        then: promise.then.bind(promise),
        catch: promise.catch.bind(promise),
        abort: controller.abort.bind(controller),
    };
}

module.exports = httpRequest;
