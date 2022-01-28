/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/**
 * @module httpRequest
 */

var FetchrError = require('./FetchrError');

function shouldRetry(err, options, attempt) {
    if (err.reason === FetchrError.ABORT) {
        return false;
    }

    if (attempt >= options.retry.maxRetries) {
        return false;
    }

    if (options.method === 'POST' && !options.retry.retryOnPost) {
        return false;
    }

    return options.retry.statusCodes.indexOf(err.statusCode) !== -1;
}

function delayPromise(fn, delay) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            fn().then(resolve, reject);
        }, delay);
    });
}

function io(options, controller) {
    var timedOut = false;
    var request = new Request(options.url, {
        body: options.body,
        credentials: options.credentials,
        headers: options.headers,
        method: options.method,
        signal: controller.signal,
    });

    var timeoutId = setTimeout(function () {
        timedOut = true;
        controller.abort();
    }, options.timeout);

    return fetch(request).then(
        function (response) {
            clearTimeout(timeoutId);

            if (response.ok) {
                return response.json().catch(function () {
                    throw new FetchrError(
                        FetchrError.BAD_JSON,
                        'Cannot parse response into a JSON object',
                        options,
                        request,
                        response
                    );
                });
            } else {
                return response.text().then(function (message) {
                    throw new FetchrError(
                        FetchrError.BAD_HTTP_STATUS,
                        message,
                        options,
                        request,
                        response
                    );
                });
            }
        },
        function (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                if (timedOut) {
                    throw new FetchrError(
                        FetchrError.TIMEOUT,
                        'Request failed due to timeout',
                        options,
                        request
                    );
                }

                throw new FetchrError(
                    FetchrError.ABORT,
                    err.message,
                    options,
                    request
                );
            }

            throw new FetchrError(
                FetchrError.UNKNOWN,
                err.message,
                options,
                request
            );
        }
    );
}

function httpRequest(options) {
    var controller = new AbortController();
    var currentAttempt = 0;

    // handleError is the onReject promise callback that we attach to
    // the io call (ex. io().catch(handleError)). Since io is a
    // promise and since we must be able to retry requests (aka call
    // io function again), we must call io from within
    // handleError. This means that handleError is a recursive
    // function. Recursive promises are problematic since they can
    // block the main thread for a while. However, since the inner io
    // call is wrapped in a setTimeout (through delayPromise) we are
    // safe here.
    //
    // The call flow:
    //
    // httpRequest -> io -> handleError -> io -> handleError -> end
    function handleError(err) {
        if (!shouldRetry(err, options, currentAttempt)) {
            throw err;
        }

        // Use exponential backoff and full jitter
        // strategy published in
        // https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
        var delay =
            Math.random() *
            options.retry.interval *
            Math.pow(2, currentAttempt);

        controller = new AbortController();
        currentAttempt += 1;
        return delayPromise(function () {
            return io(options, controller).catch(handleError);
        }, delay);
    }

    var promise = io(options, controller).catch(handleError);

    return {
        then: promise.then.bind(promise),
        catch: promise.catch.bind(promise),

        // Differently from then and catch, we must wrap
        // controller.abort in our own function to make sure that we
        // have a fresh reference to the current AbortController being
        // used. If we don't do it, controller will point to the first
        // request, preventing users to abort subsequent requests in
        // case of retries.
        abort: function () {
            return controller.abort();
        },
    };
}

module.exports = httpRequest;
