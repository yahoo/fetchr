/**
 * Copyright 2016, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
var DEFAULT_XHR_PATH = '/api';

var express = require('express');
var bodyParser = require('body-parser');
var app = express();

var FetcherServer = require('../../libs/fetcher');
var mockService = require('./MockService');
var mockErrorService = require('./MockErrorService');
var mockNoopService = require('./MockNoopService');
FetcherServer.registerService(mockService);
FetcherServer.registerService(mockErrorService);
FetcherServer.registerService(mockNoopService);

app.use(bodyParser.json());
app.use(DEFAULT_XHR_PATH, FetcherServer.middleware());

module.exports = app;
module.exports.DEFAULT_XHR_PATH = DEFAULT_XHR_PATH;
