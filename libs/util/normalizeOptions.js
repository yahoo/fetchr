var pickContext = require('./pickContext');
var url = require('./url');

var MAX_URI_LEN = 2048;

function normalizeOptions(request) {
    var options = {};

    var config = Object.assign(
        {
            unsafeAllowRetry: request.operation === 'read',
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

module.exports = normalizeOptions;
