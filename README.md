# Fetchr

[![npm version](https://badge.fury.io/js/fetchr.svg)](http://badge.fury.io/js/fetchr)
![Build Status](https://github.com/yahoo/fetchr/actions/workflows/node.js.yml/badge.svg)
[![Coverage Status](https://coveralls.io/repos/yahoo/fetchr/badge.png?branch=master)](https://coveralls.io/r/yahoo/fetchr?branch=master)

Universal data access layer for web applications.

Typically on the server, you call your API or database directly to fetch some data. However, on the client, you cannot always call your services in the same way (i.e, cross domain policies). Instead, XHR requests need to be made to the server which get forwarded to your service.

Having to write code differently for both environments is duplicative and error prone. Fetchr provides an abstraction layer over your data service calls so that you can fetch data using the same API on the server and client side.

## Install

```bash
npm install fetchr --save
```

## Setup

Follow the steps below to setup Fetchr properly. This assumes you are using the [Express](https://www.npmjs.com/package/express) framework.

### 1. Configure Server

On the server side, add the Fetchr middleware into your express app at a custom API endpoint.

Fetchr middleware expects that you're using the [`body-parser`](https://github.com/expressjs/body-parser) middleware (or an alternative middleware that populates `req.body`) before you use Fetchr middleware.

```js
import express from 'express';
import Fetcher from 'fetchr';
import bodyParser from 'body-parser';
const app = express();

// you need to use body-parser middleware before fetcher middleware
app.use(bodyParser.json());

app.use('/myCustomAPIEndpoint', Fetcher.middleware());
```

### 2. Configure Client

On the client side, it is necessary for the `xhrPath` option to match the path where the middleware was mounted in the previous step

`xhrPath` is an optional config property that allows you to customize the endpoint to your services, defaults to `/api`.

```js
import Fetcher from 'fetchr';
const fetcher = new Fetcher({
    xhrPath: '/myCustomAPIEndpoint',
});
```

### 3. Register data services

You will need to register any data services that you wish to use in
your application. The interface for your service will be an object
that must define a `resource` property and at least one
[CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete)
operation. The `resource` property will be used when you call one of the
CRUD operations.

```js
// app.js
import Fetcher from 'fetchr';
import myDataService from './dataService';
Fetcher.registerService(myDataService);
```

```js
// dataService.js
export default {
    // resource is required
    resource: 'data_service',
    // at least one of the CRUD methods is required
    read: function (req, resource, params, config, callback) {
        //...
    },
    // other methods
    // create: function(req, resource, params, body, config, callback) {},
    // update: function(req, resource, params, body, config, callback) {},
    // delete: function(req, resource, params, config, callback) {}
};
```

### 4. Instantiating the Fetchr Class

Data services might need access to each individual request, for example, to get the current logged in user's session.
For this reason, Fetcher will have to be instantiated once per request.

On the serverside, this requires fetcher to be instantiated per request, in express middleware.
On the clientside, this only needs to happen on page load.

```js
// app.js - server
import express from 'express';
import Fetcher from 'fetchr';
import myDataService from './dataService';
const app = express();

// register the service
Fetcher.registerService(myDataService);

// register the middleware
app.use('/myCustomAPIEndpoint', Fetcher.middleware());

app.use(function(req, res, next) {
    // instantiated fetcher with access to req object
    const fetcher = new Fetcher({
        xhrPath: '/myCustomAPIEndpoint', // xhrPath will be ignored on the serverside fetcher instantiation
        req: req
    });

    // perform read call to get data
    fetcher
        .read('data_service')
        .params({id: ###})
        .end(function (err, data, meta) {
        // handle err and/or data returned from data fetcher in this callback
        });
});
```

```js
// app.js - client
import Fetcher from 'fetchr';
const fetcher = new Fetcher({
    xhrPath: '/myCustomAPIEndpoint' // xhrPath is REQUIRED on the clientside fetcher instantiation
});
fetcher
    .read('data_api_fetcher')
    .params({id: ###})
    .end(function (err, data, meta) {
    // handle err and/or data returned from data fetcher in this callback
    });

// for create you can use the body() method to pass data
fetcher
    .create('data_api_create')
    .body({"some":"data"})
    .end(function (err, data, meta) {
    // handle err and/or data returned from data fetcher in this callback
    });
```

## Usage Examples

See the [simple example](https://github.com/yahoo/fetchr/tree/master/examples/simple).

## Service Metadata

Service calls on the client transparently become xhr requests.
It is a good idea to set cache headers on common xhr calls.
You can do so by providing a third parameter in your service's callback.
If you want to look at what headers were set by the service you just called,
simply inspect the third parameter in the callback.

Note: If you're using promises, the metadata will be available on the `meta`
property of the resolved value.

```js
// dataService.js
export default {
    resource: 'data_service',
    read: function (req, resource, params, config, callback) {
        // business logic
        const data = 'response';
        const meta = {
            headers: {
                'cache-control': 'public, max-age=3600',
            },
            statusCode: 200, // You can even provide a custom statusCode for the xhr response
        };
        callback(null, data, meta);
    },
};
```

```js
fetcher
    .read('data_service')
    .params({id: ###})
    .end(function (err, data, meta) {
        // data will be 'response'
        // meta will have the header and statusCode from above
    });
```

There is a convenience method called `fetcher.getServiceMeta` on the fetchr instance.
This method will return the metadata for all the calls that have happened so far
in an array format.
In the server, this will include all service calls for the current request.
In the client, this will include all service calls for the current session.

## Updating Configuration

Usually you instantiate fetcher with some default options for the entire browser session,
but there might be cases where you want to update these options later in the same session.

You can do that with the `updateOptions` method:

```js
// Start
const fetcher = new Fetcher({
    xhrPath: '/myCustomAPIEndpoint',
    xhrTimeout: 2000,
});

// Later, you may want to update the xhrTimeout
fetcher.updateOptions({
    xhrTimeout: 4000,
});
```

## Error Handling

When an error occurs in your Fetchr CRUD method, you should return an error object to the callback. The error object should contain a `statusCode` (default 500) and `output` property that contains a JSON serializable object which will be sent to the client.

```js
export default {
    resource: 'FooService',
    read: function create(req, resource, params, configs, callback) {
        const err = new Error('it failed');
        err.statusCode = 404;
        err.output = { message: 'Not found', more: 'meta data' };
        return callback(err);
    },
};
```

And in your service call:

```js
fetcher
    .read('someData')
    .params({id: ###})
    .end(function (err, data, meta) {
        if (err) {
            // err.output will be { message: "Not found", more: "meta data" }
        }
    });
```

## XHR Object

The xhr object is returned by the `.end()` method as long as you're _not_ chaining promises.
This is useful if you want to abort a request before it is completed.

```js
const req = fetcher
    .read('someData')
    .params({id: ###})
    .end(function (err, data, meta) {
        // err.output will be { message: "Not found", more: "meta data" }
    });
// req is the xhr object
req.abort();
```

However, you can't acces the xhr object if using promise chaining like so:

```js
const req = fetcher
    .read('someData')
    .params({id: ###})
    .end();
// req is a promise
req.then(onResolve, onReject);
```

## XHR Timeouts

`xhrTimeout` is an optional config property that allows you to set timeout (in ms) for all clientside requests, defaults to `3000`.
On the clientside, xhrPath and xhrTimeout will be used for XHR requests.
On the serverside, xhrPath and xhrTimeout are not needed and are ignored.

```js
import Fetcher from 'fetchr';
const fetcher = new Fetcher({
    xhrPath: '/myCustomAPIEndpoint',
    xhrTimeout: 4000,
});
```

If you have an individual request that you need to ensure has a specific timeout you can do that via the `timeout` option in `clientConfig`:

```js
fetcher
    .read('someData')
    .params({id: ###})
    .clientConfig({timeout: 5000}) // wait 5 seconds for this request before timing it out
    .end(function (err, data, meta) {
    // handle err and/or data returned from data fetcher in this callback
    });
```

## XHR Params Processing

For some applications, there may be a situation where you need to process the service params passed in XHR request before params are sent to the actual service. Typically, you would process these params in the service itself. However, if you want to perform processing across many services (i.e. sanitization for security), then you can use the `paramsProcessor` option.

`paramsProcessor` is a function that is passed into the `Fetcher.middleware` method. It is passed three arguments, the request object, the serviceInfo object, and the service params object. The `paramsProcessor` function can then modify the service params if needed.

Here is an example:

```js
/**
    Using the app.js from above, you can modify the Fetcher.middleware
    method to pass in the paramsProcessor function.
 */
app.use(
    '/myCustomAPIEndpoint',
    Fetcher.middleware({
        paramsProcessor: function (req, serviceInfo, params) {
            console.log(serviceInfo.resource, serviceInfo.operation);
            return Object.assign({ foo: 'fillDefaultValueForFoo' }, params);
        },
    })
);
```

## XHR Response Formatting

For some applications, there may be a situation where you need to modify an XHR response before it is passed to the client. Typically, you would apply your modifications in the service itself. However, if you want to modify the XHR responses across many services (i.e. add debug information), then you can use the `responseFormatter` option.

`responseFormatter` is a function that is passed into the `Fetcher.middleware` method. It is passed three arguments, the request object, response object and the service response object (i.e. the data returned from your service). The `responseFormatter` function can then modify the service response to add additional information.

Take a look at the example below:

```js
/**
    Using the app.js from above, you can modify the Fetcher.middleware
    method to pass in the responseFormatter function.
 */
app.use(
    '/myCustomAPIEndpoint',
    Fetcher.middleware({
        responseFormatter: function (req, res, data) {
            data.debug = 'some debug information';
            return data;
        },
    })
);
```

Now when an XHR request is performed, your response will contain the `debug` property added above.

## CORS Support

Fetchr provides [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS) support by allowing you to pass the full origin host into `corsPath` option.

For example:

```js
import Fetcher from 'fetchr';
const fetcher = new Fetcher({
    corsPath: 'http://www.foo.com',
    xhrPath: '/fooProxy',
});
fetcher
    .read('service')
    .params({ foo: 1 })
    .clientConfig({ cors: true })
    .end(callbackFn);
```

Additionally, you can also customize how the GET URL is constructed by passing in the `constructGetUri` property when you execute your `read` call:

```js
import qs from 'qs';
function customConstructGetUri(uri, resource, params, config) {
    // this refers to the Fetcher object itself that this function is invoked with.
    if (config.cors) {
        return uri + '/' + resource + '?' + qs.stringify(this.context);
    }
    // Return `falsy` value will result in `fetcher` using its internal path construction instead.
}

import Fetcher from 'fetchr';
const fetcher = new Fetcher({
    corsPath: 'http://www.foo.com',
    xhrPath: '/fooProxy',
});
fetcher
    .read('service')
    .params({ foo: 1 })
    .clientConfig({
        cors: true,
        constructGetUri: customConstructGetUri,
    })
    .end(callbackFn);
```

## CSRF Protection

You can protect your XHR paths from CSRF attacks by adding a middleware in front of the fetchr middleware:

`app.use('/myCustomAPIEndpoint', csrf(), Fetcher.middleware());`

You could use https://github.com/expressjs/csurf for this as an example.

Next you need to make sure that the CSRF token is being sent with our XHR requests so that they can be validated. To do this, pass the token in as a key in the `options.context` object on the client:

```js
const fetcher = new Fetcher({
    xhrPath: '/myCustomAPIEndpoint', //xhrPath is REQUIRED on the clientside fetcher instantiation
    context: {
        // These context values are persisted with XHR calls as query params
        _csrf: 'Ax89D94j',
    },
});
```

This `_csrf` will be sent in all XHR requests as a query parameter so that it can be validated on the server.

## Service Call Config

When calling a Fetcher service you can pass an optional config object.

When this call is made from the client, the config object is used to define XHR request options and can be used to override default options:

```js
//app.js - client
const config = {
    timeout: 6000, // Timeout (in ms) for each request
    unsafeAllowRetry: false, // for POST requests, whether to allow retrying this post
};

fetcher.read('service').params({ id: 1 }).clientConfig(config).end(callbackFn);
```

For requests from the server, the config object is simply passed into the service being called.

## Retry

You can set Fetchr to retry failed requests automatically by setting a
`retry` settings in the client configuration:

```js
fetcher
    .read('service')
    .clientConfig({
        retry: {
            maxRetries: 2,
        },
    })
    .end();
```

With this configuration, Fetchr will retry all requests that fail with 408 status code or with an XHR 0 status code two more times before returning an error. The interval between each request respects
the following formula, based on the exponential backoff and full jitter strategy published in [this AWS architecture blog post](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/):

```js
Math.random() * Math.pow(2, attempt) * interval;
```

`attempt` is the number of the current retry attempt starting
from 0. By default `interval` corresponds to 200ms.

You can customize the retry behavior by adding more properties in the
`retry` object:

```js
fetcher
    .read('resource')
    .clientConfig({
        retry: {
            maxRetries: 5,
            interval: 1000,
            statusCodes: [408, 502],
        },
    })
    .end();
```

With the above configuration, Fetchr will retry all failed (408 or 502 status code) requests for a maximum of 5 times. The interval between each request will still use the formula from above, but the interval of 1000ms will be used instead.

**Note:** Fetchr doesn't retry POST requests for safety reasons. You can enable retries for POST requests by setting the `unsafeAllowRetry` property to `true`:

```js
fetcher
    .create('resource')
    .clientConfig({
        retry: { maxRetries: 2 },
        unsafeAllowRetry: true,
    })
    .end();
```

## Context Variables

By Default, fetchr appends all context values to the xhr url as query params. `contextPicker` allows you to greater control over which context variables get sent as query params depending on the xhr method (`GET` or `POST`). This is useful when you want to limit the number of variables in a `GET` url in order not to accidentally [cache bust](http://webassets.readthedocs.org/en/latest/expiring.html).

`contextPicker` follows the same format as the `predicate` parameter in [`lodash/pickBy`](https://lodash.com/docs#pickBy) with two arguments: `(value, key)`.

```js
const fetcher = new Fetcher({
    context: {
        // These context values are persisted with XHR calls as query params
        _csrf: 'Ax89D94j',
        device: 'desktop',
    },
    contextPicker: {
        GET: function (value, key) {
            // for example, if you don't enable CSRF protection for GET, you are able to ignore it with the url
            if (key === '_csrf') {
                return false;
            }
            return true;
        },
        // for other method e.g., POST, if you don't define the picker, it will pick the entire context object
    },
});

const fetcher = new Fetcher({
    context: {
        // These context values are persisted with XHR calls as query params
        _csrf: 'Ax89D94j',
        device: 'desktop',
    },
    contextPicker: {
        GET: ['device'], // predicate can be an array of strings
    },
});
```

## Custom Request Headers

When calling a Fetcher service you can add custom request headers.

A request contains custom headers when you add `headers` option to 'clientConfig'.

```js
const config = {
    headers: {
        'X-VERSION': '1.0.0',
    },
};

fetcher.read('service').params({ id: 1 }).clientConfig(config).end(callbackFn);
```

All requests contain custom headers when you add `headers` option to constructor arguments of 'Fetcher'.

```js
import Fetcher from 'fetchr';
const fetcher = new Fetcher({
    headers: {
        'X-VERSION': '1.0.0',
    },
});
```

## Stats Monitoring & Analysis

To collect fetcher service's success/failure/latency stats, you can configure `statsCollector` for `Fetchr`. The `statsCollector` function will be invoked with one argumment: `stats`. The `stats` object will contain the following fields:

-   **resource:** The name of the resource for the request
-   **operation:** The name of the operation, `create|read|update|delete`
-   **params:** The params object for the resource
-   **statusCode:** The status code of the response
-   **err:** The error object of failed request; null if request was successful
-   **time:** The time spent for this request, in milliseconds

### Fetcher Instance

```js
import Fetcher from 'fetchr';
const fetcher = new Fetcher({
    xhrPath: '/myCustomAPIEndpoint',
    statsCollector: function (stats) {
        // just console logging as a naive example.  there is a lot more you can do here,
        // like aggregating stats or filtering out stats you don't want to monitor
        console.log(
            'Request for resource',
            stats.resource,
            'with',
            stats.operation,
            'returned statusCode:',
            stats.statusCode,
            ' within',
            stats.time,
            'ms'
        );
    },
});
```

### Server Middleware

```js
app.use(
    '/myCustomAPIEndpoint',
    Fetcher.middleware({
        statsCollector: function (stats) {
            // just console logging as a naive example.  there is a lot more you can do here,
            // like aggregating stats or filtering out stats you don't want to monitor
            console.log(
                'Request for resource',
                stats.resource,
                'with',
                stats.operation,
                'returned statusCode:',
                stats.statusCode,
                ' within',
                stats.time,
                'ms'
            );
        },
    })
);
```

## API

-   [Fetchr](https://github.com/yahoo/fetchr/blob/master/docs/fetchr.md)

## License

This software is free to use under the Yahoo! Inc. BSD license.
See the [LICENSE file][] for license text and copyright information.

[license file]: https://github.com/yahoo/fetchr/blob/master/LICENSE.md
