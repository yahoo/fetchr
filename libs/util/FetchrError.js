function FetchrError(reason, message, options, request, response) {
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
    this.reason = reason;
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

FetchrError.ABORT = 'ABORT';
FetchrError.BAD_HTTP_STATUS = 'BAD_HTTP_STATUS';
FetchrError.BAD_JSON = 'BAD_JSON';
FetchrError.TIMEOUT = 'TIMEOUT';
FetchrError.UNKNOWN = 'UNKNOWN';

module.exports = FetchrError;
