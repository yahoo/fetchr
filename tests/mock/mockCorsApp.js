/**
 * Copyright 2016, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
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
app.use(function cors (req, res, next) {
    if (req.query.cors) {
        res.set('Access-Control-Allow-Origin', '*');
        next();
    } else {
        res.sendStatus(403);
    }
});
app.use(FetcherServer.middleware());

var CORS_PORT = 3001;
module.exports = app.listen(CORS_PORT);
module.exports.corsPath = 'http://localhost:' + CORS_PORT;
