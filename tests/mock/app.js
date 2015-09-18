/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

var http = require('http');
var express = require('express');
var bodyParser = require('body-parser');
var Fetcher = require('../../libs/fetcher.js');
var mockService = require('./MockService');
var mockErrorService = require('./MockErrorService');

Fetcher.registerService(mockService);
Fetcher.registerService(mockErrorService);

var app = express();
app.use(bodyParser.json());
app.use('/api', Fetcher.middleware());
var port = process.env.PORT || 3000;
var server = http.createServer(app).listen(port);
console.log('Listening on port ' + port);
module.exports = server;
module.exports.cleanup = function () {
    Fetcher.services = {};
};
