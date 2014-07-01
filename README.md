# Fetchr [![Build Status](https://travis-ci.org/yahoo/fetchr.svg?branch=master)](https://travis-ci.org/yahoo/fetchr) [![Dependency Status](https://david-dm.org/yahoo/fetchr.svg)](https://david-dm.org/yahoo/fetchr)

Fetchr augments [Flux][] applications by allowing [Flux][] stores to be used on server and client to fetch data.

On the server, stores can call the database directly to fetch some data.

On the client, however, stores can NOT call the database in the same way. Instead, xhr requests need to be made to the server( then to the database) and then the response can be parsed client side.

Fetchr provides an appropriate abstraction so that you can fetch (CRUD) your data in your stores using the same exact syntax on server and client side.

# Install

```
npm install fetchr
```

# Setup

Fetchr needs delicate set up to work properly.

## 1. Middleware

On the server side, add the fetchr middleware into your express app.

```js
var express = require('express'),
    fetcher = require('fetchr'),
    app = express();

app.use(fetcher.middleware(
    pathPrefix: '/myCustomAPIEndpoint'
));
```

## 2. API pathPrefix

`pathPrefix` config option for the middleware is optional. Defaults to `/api`.

It is necessary to expose this prefix to the client side fetcher (`fetchr.client.js`) via a global variable, `window.fetcherPathPrefix`.

After setting up the middleware, you can get the pathPrefix by calling `fetcher.getPathPrefix()` and assign it to the global `window.fetcherPathPrefix`.


## 3. Register data fetchers for API and/or DB access

```js
//app.js
//...
var fetcher = require('fetchr'),
    myDataFetcher = require('./dataFetcher');

fetcher.addFetcher(myDataFetcher);
//...
```

```js
//dataFetcher.js
module.exports = {
    //Name is required
    name: 'data_api_fetcher',
    //At least one of the CRUD methods is Required
    read: function(resource, params, context, callback) {
      //...
    },
    //other methods
    //create: function(resource, params, body, context, callback) {},
    //update: function(resource, params, body, context, callback) {},
    //del: function(resource, params, context, callback) {}
}

```

## 4. Swap Fetchr <=> Fetchr.client

Fetchr relies on a build process that swaps out `lib/fetchr.js` with `lib/fetchr.client.js` in the bundle that is generated for client side use. Usually the bundle is generated using tools like [webpack](http://webpack.github.io/) or [browserify](http://browserify.org/).

```
//webpack config
plugins: [
    //...
    //Replace fetcher lib with client side fetcher lib
    new webpack.NormalModuleReplacementPlugin(/^fetchr$/, require.resolve('fetchr/libs/fetcher.client.js'))
    //...
]
```

# Usage Examples

See the [simple example](https://github.com/yahoo/fetchr/tree/master/examples/simple)

# License

This software is free to use under the Yahoo! Inc. BSD license.
See the [LICENSE file][] for license text and copyright information.

[LICENSE file]: https://github.com/yahoo/fetchr/blob/master/LICENSE.md

[Flux]: http://facebook.github.io/react/docs/flux-overview.html
