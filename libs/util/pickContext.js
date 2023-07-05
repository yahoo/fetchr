var forEach = require('./forEach');

/**
 * Pick keys from the context object
 * @method pickContext
 * @param {Object} context - context object
 * @param {Function|Array|String} picker - key, array of keys or
 * function that return keys to be extracted from context.
 * @param {String} method - method name, GET or POST
 */
function pickContext(context, picker, method) {
    if (!picker || !picker[method]) {
        return context;
    }

    var p = picker[method];
    var result = {};

    if (typeof p === 'string') {
        result[p] = context[p];
    } else if (Array.isArray(p)) {
        p.forEach(function (key) {
            result[key] = context[key];
        });
    } else if (typeof p === 'function') {
        forEach(context, function (value, key) {
            if (p(value, key, context)) {
                result[key] = context[key];
            }
        });
    } else {
        throw new TypeError(
            'picker must be an string, an array, or a function.',
        );
    }

    return result;
}

module.exports = pickContext;
