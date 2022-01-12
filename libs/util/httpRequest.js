/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/**
 * @module httpRequest
 */

function FetchrError(message, options, request, response) {
    this.body = null;
    this.message = message;
    this.meta = null;
    this.name = 'FetchrError';
    this.output = null;
    this.rawRequest = {
        headers: options.headers,
        method: request.method,
        url: request.url,
    };
    this.statusCode = response ? response.status : 0;
    this.timeout = options.timeout;
    this.url = request.url;

    if (response) {
        try {
            this.body = JSON.parse(message);
            this.output = this.body.output || null;
            this.meta = this.body.meta || null;
            this.message = this.body.message || message;
        } catch (e) {
            this.body = message;
        }
    }
}

FetchrError.prototype = Object.create(Error.prototype);
FetchrError.prototype.constructor = FetchrError;

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
                return response.text().then(function (message) {
                    throw new FetchrError(message, options, request, response);
                });
            }
        },
        function (err) {
            clearTimeout(timeoutId);
            throw new FetchrError(err.message, options, request);
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
