var pickContext = require('./pickContext');
var url = require('./url');

var MAX_URI_LEN = 2048;

function requestToOptions(request) {
    var options = {};

    var config = Object.assign(
        {
            xhrTimeout: request.options.xhrTimeout,
        },
        request._clientConfig
    );
    options.config = config;
    options.headers = config.headers || request.options.headers || {};

    var baseUrl = config.uri;
    if (!baseUrl) {
        baseUrl = config.cors
            ? request.options.corsPath
            : request.options.xhrPath;
    }

    if (request.operation === 'read' && !config.post_for_read) {
        options.method = 'GET';

        var buildGetUrl =
            typeof config.constructGetUri === 'function'
                ? config.constructGetUri
                : url.buildGETUrl;

        var context = pickContext(
            request.options.context,
            request.options.contextPicker,
            'GET'
        );

        var args = [
            baseUrl,
            request.resource,
            request._params,
            request._clientConfig,
            context,
        ];

        // If a custom getUriFn returns falsy value, we should run urlUtil.buildGETUrl
        // TODO: Add test for this fallback
        options.url =
            buildGetUrl.apply(request, args) ||
            url.buildGETUrl.apply(request, args);

        if (options.url.length <= MAX_URI_LEN) {
            return options;
        }
    }

    options.method = 'POST';
    options.url = url.buildPOSTUrl(baseUrl, request);
    options.data = {
        body: request._body,
        context: request.options.context,
        operation: request.operation,
        params: request._params,
        resource: request.resource,
    };

    return options;
}

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

function normalizeRetry(request) {
    var retry = Object.assign(
        {
            interval: 200,
            maxRetries: 0,
            retryOnPost:
                request.operation === 'read' ||
                request.options.unsafeAllowRetry,
            statusCodes: [0, 408, 999],
        },
        request.options.retry,
        request._clientConfig.retry
    );

    if ('unsafeAllowRetry' in request._clientConfig) {
        retry.retryOnPost = request._clientConfig.unsafeAllowRetry;
    }

    if (retry.max_retries) {
        console.warn(
            '"max_retries" is deprecated and will be removed in a future release, use "maxRetries" instead.'
        );
        retry.maxRetries = retry.max_retries;
    }

    return retry;
}

function normalizeOptions(request) {
    var options = requestToOptions(request);
    return {
        credentials: options.config.withCredentials ? 'include' : 'same-origin',
        body: options.data != null ? JSON.stringify(options.data) : undefined,
        headers: normalizeHeaders(options),
        method: options.method,
        retry: normalizeRetry(request),
        timeout: options.config.timeout || options.config.xhrTimeout,
        url: options.url,
    };
}

module.exports = normalizeOptions;
