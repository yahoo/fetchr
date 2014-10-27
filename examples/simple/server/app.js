/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
var http = require('http'),
    path = require('path'),
    fs = require('fs'),
    express = require('express'),
    bodyParser = require('body-parser'),
    config = require('../shared/config'),
    Fetcher = require('../../../libs/fetcher.js'),
    readFlickr = require('../shared/getFlickrPhotos'),
    flickrFetcher = require('./fetchers/flickr'),
    readFlickrServer,
    templatePath = path.join(__dirname, '..', 'shared', 'index.html');

Fetcher.registerFetcher(flickrFetcher);

var app = express();

app.use(bodyParser.json());

app.use(config.xhrPath, Fetcher.middleware());


app.use('/server', function (req, res, next) {

    var fetcher = new Fetcher({req: req});

    //client specific callback
    readFlickrServer = function(err, data) {
        if(err) {
            throw err;
        }

        //server specific logic
        var tpl = fs.readFileSync(templatePath, {encoding: 'utf8'}),
            output = JSON.stringify(data);


        // set the environment h1
        tpl = tpl.replace('<h1 id="env"></h1>', '<h1 id="env">Server</h1>');
        // remove script tag
        tpl = tpl.replace('<script src="/app.js"></script>', '');
        // output the data
        tpl = tpl.replace('<div id="flickr-data"></div>', output);

        res.send(tpl);
    };

    //client-server agnostic call for data
    readFlickr(fetcher, readFlickrServer);

});

//For the webpack built app.js that is needed by the index.html client file
app.use(express.static(path.join(__dirname, '..', 'client', 'build')));

//For the index.html file
app.use('/client', function(req, res) {
    var tpl = fs.readFileSync(templatePath, {encoding: 'utf8'});
    res.send(tpl);
});

var port = process.env.PORT || 3000;
http.createServer(app).listen(port);
console.log('Listening on port ' + port);
