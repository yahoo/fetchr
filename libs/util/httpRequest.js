/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/**
 * @module httpRequest
 */

var FetchrError = require('./FetchrError');

function _shouldRetry(err) {
    if (err.reason === FetchrError.ABORT) {
        return false;
    }

    if (this._currentAttempt >= this._options.retry.maxRetries) {
        return false;
    }

    if (this._options.method === 'POST' && !this._options.retry.retryOnPost) {
        return false;
    }

    return this._options.retry.statusCodes.indexOf(err.statusCode) !== -1;
}

// _retry is the onReject promise callback that we attach to the
// _fetch call (ex. _fetch().catch(_retry)). Since _fetch is a promise
// and since we must be able to retry requests (aka call _fetch
// function again), we must call _fetch from within _retry. This means
// that _fetch is a recursive function. Recursive promises are
// problematic since they can block the main thread for a
// while. However, since the inner _fetch call is wrapped in a
// setTimeout we are safe here.
//
// The call flow:
//
// send -> _fetch -> _retry -> _fetch -> _retry -> end
function _retry(err) {
    var self = this;
    if (!_shouldRetry.call(self, err)) {
        throw err;
    }

    // Use exponential backoff and full jitter
    // strategy published in
    // https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
    var delay =
        Math.random() *
        self._options.retry.interval *
        Math.pow(2, self._currentAttempt);

    self._controller = new AbortController();
    self._currentAttempt += 1;

    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            _fetch.call(self).then(resolve, reject);
        }, delay);
    });
}

function _fetch() {
    var self = this;
    var timedOut = false;
    var request = new Request(self._options.url, {
        body: self._options.body,
        credentials: self._options.credentials,
        headers: self._options.headers,
        method: self._options.method,
        signal: self._controller.signal,
    });

    var timeoutId = setTimeout(function () {
        timedOut = true;
        self._controller.abort();
    }, self._options.timeout);

    return fetch(request)
        .then(
            function (response) {
                clearTimeout(timeoutId);

                if (response.ok) {
                    return response.json().catch(function () {
                        throw new FetchrError(
                            FetchrError.BAD_JSON,
                            'Cannot parse response into a JSON object',
                            self._options,
                            request,
                            response,
                        );
                    });
                } else {
                    return response.text().then(function (message) {
                        throw new FetchrError(
                            FetchrError.BAD_HTTP_STATUS,
                            message,
                            self._options,
                            request,
                            response,
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
                            self._options,
                            request,
                        );
                    }

                    throw new FetchrError(
                        FetchrError.ABORT,
                        err.message,
                        self._options,
                        request,
                    );
                }

                throw new FetchrError(
                    FetchrError.UNKNOWN,
                    err.message,
                    self._options,
                    request,
                );
            },
        )
        .catch(_retry.bind(self));
}

function _send() {
    this._promise = _fetch.call(this);
}

function FetchrHttpRequest(options) {
    this._controller = new AbortController();
    this._currentAttempt = 0;
    this._options = options;
    this._promise = null;
}

FetchrHttpRequest.prototype.abort = function () {
    return this._controller.abort();
};

FetchrHttpRequest.prototype.then = function (resolve, reject) {
    this._promise = this._promise.then(resolve, reject);
    return this;
};

FetchrHttpRequest.prototype.catch = function (reject) {
    this._promise = this._promise.catch(reject);
    return this;
};

function httpRequest(options) {
    var request = new FetchrHttpRequest(options);
    _send.call(request);
    return request;
}

module.exports = httpRequest;
