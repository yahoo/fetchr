/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
'use strict';

var path = require('path'),
    fs = require('fs'),

    koa = require('koa'),
    serve = require('koa-static'),
    body = require('koa-body'),
    send = require('koa-send'),
    thunkify = require('thunkify-wrap'),

    config = require('../../simple/shared/config'),
    Fetcher = require('../../../libs/fetcher.js'),
    readFlickr = require('../../simple/shared/getFlickrPhotos'),
    flickrFetcher = require('../../simple/server/fetchers/flickr'),
    templatePath = path.join(__dirname, '../../simple', 'shared', 'index.html');

Fetcher.registerFetcher(flickrFetcher);

var app = koa();
readFlickr = thunkify(readFlickr);

// Turn Fetcher.single into generator
var fetcherSingle = thunkify(function fetcherSingle (request, callback) {
    request.callback = callback;

    Fetcher.single(request);
});


/*
 * Read flickr server
 *
 * @method readFlickrServer
 * @param {Object} data
 * @return {String} tpl
 */
function readFlickrServer (data) {
    //server specific logic
    var tpl = fs.readFileSync(templatePath, {encoding: 'utf8'}),
        output = JSON.stringify(data);

    // set the environment h1
    tpl = tpl.replace('<h1 id="env"></h1>', '<h1 id="env">Server</h1>');
    // remove script tag
    tpl = tpl.replace('<script src="/app.js"></script>', '');
    // output the data
    tpl = tpl.replace('<div id="flickr-data"></div>', output);

    return tpl;
}


app.use(body());
app.use(function *(next) {
    yield next;

    if(this.path.indexOf(config.xhrPath) > -1) {
        let  resource = this.path.substr((config.xhrPath + '/resource/').length).split(';');

        // Create express like req
        // TODO: general function to create the request object from koa "this"
        let req = {
            path: this.path,
            method: this.request.method,
            body: this.request.body,
            resource: resource.shift(),
            params: resource.shift().substr('method='.length),
            operation: 'read',
            config: {}
        };

        let data;

        try {
            data = yield fetcherSingle(req);
        } catch(err) {
            this.app.emit('error', err, this);
            this.throw(500);
        }

        this.body = data;
    }
});

app.use(function *(next) {
    yield next;

    if(this.path === '/server') {

        // Create express like req
        let req = {
            path: this.path,
            method: this.request.method,
            body: this.request.body
        };

        let fetcher = new Fetcher({req: req});

        try {
            let data = yield readFlickr(fetcher);
            this.body = readFlickrServer(data);
        } catch(err) {
            this.app.emit('error', err, this);
            this.throw(500);
        }
    }
});

app.use(function *(next) {
    yield next;

    if(this.path === '/client') {
        yield send(this, templatePath);
    }
});

//For the webpack built app.js that is needed by the index.html client file
app.use(serve(path.join(__dirname, '..', 'client', 'build')));

var port = process.env.PORT || 3000;
app.listen(port, function () {
    console.log('Listening on port ' + port);
});
