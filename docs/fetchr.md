# Fetchr API

## Constructor(options)

Creates a new fetchr plugin instance with the following parameters:

 * `options`: An object containing the plugin settings
 * `options.req` (required on server): The request object.  It can contain per-request/context data.
 * `options.xhrPath` (optional): The path for XHR requests. Will be ignored serverside.
 * `options.xhrTimeout` (optional): Timeout in milliseconds for all XHR requests
 * `options.corsPath` (optional): Base CORS path in case CORS is enabled
 * `options.context` (optional): The context object 
 * `options.contextPicker` (optional): The context predicate functions, it will be applied to lodash/object/pick to pick values from context object
 * `options.contextPicker.GET` (optional): GET predicate function
 * `options.contextPicker.POST` (optional): POST predicate function

## Static Methods

### registerFetcher(service)

register a service with fetchr

```js
var Fetcher = require('fetchr');

Fetcher.registerFetcher(myDataService);
```

### getFetcher(resource)

getter for a service by resource

```js
var Fetcher = require('fetchr');
var myDataService = {
    name: 'serviceResource', // resource
    read: function (){}// custom read logic
};

Fetcher.registerFetcher(myDataService);
Fetcher.getFetcher('serviceResource'); // returns myDataService
```

### middleware

getter for fetchr's express/connect middleware.

```js
var Fetcher = require('fetchr'),
    express = require('express'),
    app = express();

app.use('/myCustomAPIEndpoint', Fetcher.middleware());
```

## Instance Methods

### read(resource, params, config, callback)

Call the read method of a service.

### create(resource, params, body, config, callback)

Call the create method of a service.

### update(resource, params, body, config, callback)

Call the update method of a service.

### delete(resource, params, config, callback)

Call the delete method of a service.

### getServiceMeta()

Returns metadata for all service calls in an array format.
The 0 index will be the first service call.

### updateOptions(options)

Update the options of the fetchr instance.
