# Fetchr [![Build Status](https://travis-ci.org/yahoo/fetchr.svg?branch=master)](https://travis-ci.org/yahoo/fetchr) [![Dependency Status](https://david-dm.org/yahoo/fetchr.svg)](https://david-dm.org/yahoo/fetchr) [![Coverage Status](https://coveralls.io/repos/yahoo/fetchr/badge.png?branch=master)](https://coveralls.io/r/yahoo/fetchr?branch=master) 

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

On the server side, add the fetchr middleware into your express app at a custom API endpoint.

```js
//...
var express = require('express'),
    Fetcher = require('fetchr'),
    app = express();

app.use('/myCustomAPIEndpoint', Fetcher.middleware());
//...
```

## 2. API xhrPath

`xhrPath` config option when instantiating the Fetchr class is optional. Defaults to `/api`.

On the clientside, the xhrPath will be used for XHR requests.

On the serverside, the xhrPath isn't needed and is ignored.

Note: Even though this config is optional, it is necessary for xhrPath on the clientside fetcher to match the path where the middleware was mounted on in the previous step.

```js
//...
var Fetcher = require('fetchr'),
    fetcher = new Fetcher({
        xhrPath: '/myCustomAPIEndpoint'
    })
//...
```

## 3. Register data fetchers for API and/or DB access

```js
//app.js
//...
var Fetcher = require('fetchr'),
    myDataFetcher = require('./dataFetcher');

Fetcher.registerFetcher(myDataFetcher);
//...
```

```js
//dataFetcher.js
module.exports = {
    //Name is required
    name: 'data_api_fetcher',
    //At least one of the CRUD methods is Required
    read: function(req, resource, params, config, callback) {
      //...
    },
    //other methods
    //create: function(req, resource, params, body, config, callback) {},
    //update: function(req, resource, params, body, config, callback) {},
    //del: function(req, resource, params, config, callback) {}
}

```

## 4. Instantiating the Fetchr Class

Data fetchers might need access to each individual request, for example, to get the current logged in user's session. For this reason, Fetcher will have to be instantiated once per request.

On the serverside, this requires fetcher to be instantiated per request, in express middleware.

On the clientside, this only needs to happen on page load.


```js
//app.js - server
//...
var express = require('express'),
    Fetcher = require('fetchr'),
    app = express(),
    myDataFetcher = require('./dataFetcher');

Fetcher.registerFetcher(myDataFetcher);

app.use('/myCustomAPIEndpoint', Fetcher.middleware());

app.use(function(req, res, next) {
    //instantiated fetcher with access to req object
    var fetcher = new Fetcher({
        xhrPath: '/myCustomAPIEndpoint', //xhrPath will be ignored on the serverside fetcher instantiation
        req: req
    });

    fetcher.read('data_api_fetcher', {id: ###}, {}, function (err, data) {
        //handle err and/or data returned from data fetcher in this callback
    })
});

//...
```


```js
//app.js - client
//...
var Fetcher = require('fetchr'),
    fetcher = new Fetcher({
        xhrPath: '/myCustomAPIEndpoint', //xhrPath is REQUIRED on the clientside fetcher instantiation
        requireCrumb: false, // if crumbs should be required for each request, default: false
        context: {
            crumb: 'Ax89D94j', //optional crumb string to send back to server with each request. Validation should happen on server.
        }
    });
    fetcher.read('data_api_fetcher', {id: ###}, {}, function (err, data) {
        //handle err and/or data returned from data fetcher in this callback
    })
//...
```

# Usage Examples

See the [simple example](https://github.com/yahoo/fetchr/tree/master/examples/simple)

# License

This software is free to use under the Yahoo! Inc. BSD license.
See the [LICENSE file][] for license text and copyright information.

[LICENSE file]: https://github.com/yahoo/fetchr/blob/master/LICENSE.md

[Flux]: http://facebook.github.io/react/docs/flux-overview.html
