/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

var http = require('http');
var express = require('express');
var bodyParser = require('body-parser');

var app = express();

function dummyHandler (req, res) {
    if (req.query.corsDomain === 'test1' && req.get('origin')) {
        res.set('Access-Control-Allow-Origin', req.get('origin'));
    }
    res.status(200).json(req.query);
}

app.use(bodyParser.json());
app.get('/mock_service', dummyHandler);
app.post('/', dummyHandler);

var port = 3001;
var server = http.createServer(app).listen(port);
console.log('Listening on port ' + port);
module.exports = server;
