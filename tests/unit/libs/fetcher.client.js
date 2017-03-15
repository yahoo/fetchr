/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
/*jshint expr:true*/
/*globals before,beforeEach,after,afterEach,describe,it */
"use strict";

var expect = require('chai').expect;
var lodash = require('lodash');
var mockery = require('mockery');
var qs = require('qs');
var sinon = require('sinon');
var supertest = require('supertest');
var xhr = require('xhr');

var FakeXMLHttpRequest = sinon.FakeXMLHttpRequest;
FakeXMLHttpRequest.onCreate = handleFakeXhr;
xhr.XMLHttpRequest = FakeXMLHttpRequest;

var Fetcher = require('../../../libs/fetcher.client');
var REST = require('../../../libs/util/http.client');
var testCrud = require('../../util/testCrud');
var defaultOptions = require('../../util/defaultOptions');

// APP
var defaultApp = require('../../mock/mockApp');
var DEFAULT_XHR_PATH = defaultApp.DEFAULT_XHR_PATH;
// CORS
var corsApp = require('../../mock/mockCorsApp');
var corsPath = corsApp.corsPath;

var validateXhr = null;

function handleFakeXhr (request) {
    if (request.readyState === 0) {
        setImmediate(handleFakeXhr, request);
        return;
    }
    var method = request.method.toLowerCase();
    var url = request.url;
    var app = defaultApp;
    if (url.indexOf(corsPath) !== -1) {
        // cors mode
        app = corsPath;
        url = url.substr(corsPath.length);
        if (url[0] !== '/') {
            url = '/' + url;
        }
    }
    supertest(app)[method](url)
    .set(request.requestHeaders)
    .send(request.requestBody)
    .end(function(err, res) {
        if (err) {
            // superagent error
            request.respond(500, null, err);
            return;
        }
        if (res.error) {
            // fetcher error
            request.respond(res.error.status || 500, null, res.error.text);
            return;
        }
        validateXhr && validateXhr(request);
        request.respond(res.status, JSON.stringify(res.headers), res.text);
    });
}

var context = {_csrf: 'stuff'};
var resource = defaultOptions.resource;
var params = defaultOptions.params;
var body = defaultOptions.body;
var config = defaultOptions.config;
var callback = defaultOptions.callback;
var resolve = defaultOptions.resolve;
var reject = defaultOptions.reject;

var stats = null;

function statsCollector(s) {
    stats = s;
}

var callbackWithStats = function (operation, done) {
        return function (err, data, meta) {
            expect(stats.resource).to.eql(resource);
            expect(stats.operation).to.eql(operation);
            expect(stats.time).to.be.at.least(0);
            expect(stats.err).to.eql(err);
            expect(stats.statusCode).to.eql((err && err.statusCode) || 200);
            expect(stats.params).to.eql(params);
            callback(operation, done)(err, data, meta);
        };
    };

describe('Client Fetcher', function () {
    describe('DEFAULT', function () {
        before(function () {
            this.fetcher = new Fetcher({
                context: context,
                statsCollector: statsCollector
            });
            validateXhr = function (req) {
                if (req.method === 'GET') {
                    expect(req.url).to.contain(DEFAULT_XHR_PATH + '/' + resource);
                    expect(req.url).to.contain('?_csrf=' + context._csrf);
                    expect(req.url).to.contain('returnMeta=true');
                } else if (req.method === 'POST') {
                    expect(req.url).to.equal(DEFAULT_XHR_PATH + '?_csrf=' + context._csrf);
                }
            };
        });
        beforeEach(function () {
            stats = null;
        });
        testCrud(params, body, config, callbackWithStats, resolve, reject);
        after(function () {
            validateXhr = null;
        });
    });
    describe('CORS', function () {
        function constructGetUri (uri, resource, params, config, context) {
            params = lodash.assign(context, params);
            if (config.cors) {
                return uri + '/' + resource + '?' + qs.stringify(params);
            }
        }
        before(function () {
            validateXhr = function (req) {
                if (req.method === 'GET') {
                    expect(req.url).to.contain(corsPath);
                    expect(req.url).to.contain('_csrf=' + context._csrf);
                    expect(req.url).to.contain('returnMeta=true');
                } else if (req.method === 'POST') {
                    expect(req.url).to.contain(corsPath + '?_csrf=' + context._csrf);
                }
            };
            this.fetcher = new Fetcher({
                context: lodash.assign({cors: true}, context),
                corsPath: corsPath
            });
        });
        testCrud({
            params: params,
            body: body,
            config: {
                cors: true,
                constructGetUri: constructGetUri
            },
            disableNoConfigTests: true,
            callback: callback,
            resolve: resolve,
            reject: reject
        });
        after(function () {
            validateXhr = null;
        });
    });

    describe('xhr', function () {
        before(function () {
            this.fetcher = new Fetcher({
                context: context
            });
        });

        it('should return xhr object when calling end w/ callback', function (done) {
            var operation = 'create';
            var xhr = this.fetcher
                [operation](resource)
                .params(params)
                .body(body)
                .clientConfig(config)
                .end(callback(operation, function (err) {
                    if (err) {
                        done(err);
                        return;
                    }
                    expect(xhr.readyState).to.exist;
                    expect(xhr.abort).to.exist;
                    expect(xhr.open).to.exist;
                    expect(xhr.send).to.exist;
                    done();
                }));
        });
        it('should be able to abort xhr when calling end w/ callback', function () {
            var operation = 'create';
            var xhr = this.fetcher
                [operation](resource)
                .params(params)
                .body(body)
                .clientConfig(config)
                .end(callback(operation, function (err) {
                    if (err) {
                        // in this case, an error is good
                        // we want the error to be thrown then request is aborted
                        done();
                    }
                }));
            expect(xhr.abort).to.exist;
            xhr.abort();
        });
    });

    describe('xhrTimeout', function () {
        var DEFAULT_XHR_TIMEOUT = 3000;

        describe('should be configurable globally', function () {
            before(function () {
                mockery.registerMock('./util/http.client', {
                    get: function (url, headers, config, callback) {
                        expect(config.xhrTimeout).to.equal(4000);
                        REST.get(url, headers, config, callback);
                    },
                    post : function (url, headers, body, config, callback) {
                        expect(config.xhrTimeout).to.equal(4000);
                        REST.post(url, headers, body, config, callback);
                    }
                });
                mockery.enable({
                    useCleanCache: true,
                    warnOnUnregistered: false
                });
                Fetcher = require('../../../libs/fetcher.client');
                this.fetcher = new Fetcher({
                    context: context,
                    xhrTimeout: 4000
                });
            });
            testCrud(params, body, config, callback, resolve, reject);
            after(function () {
                mockery.deregisterMock('./util/http.client');
                mockery.disable();
            });
        });

        describe('should be configurable per each fetchr call', function () {
            before(function () {
                mockery.registerMock('./util/http.client', {
                    get: function (url, headers, config, callback) {
                        expect(config.xhrTimeout).to.equal(4000);
                        expect(config.timeout).to.equal(5000);
                        REST.get(url, headers, config, callback);
                    },
                    post : function (url, headers, body, config, callback) {
                        expect(config.xhrTimeout).to.equal(4000);
                        expect(config.timeout).to.equal(5000);
                        REST.post(url, headers, body, config, callback);
                    }
                });
                mockery.enable({
                    useCleanCache: true,
                    warnOnUnregistered: false
                });
                Fetcher = require('../../../libs/fetcher.client');
                this.fetcher = new Fetcher({
                    context: context,
                    xhrTimeout: 4000
                });
            });
            testCrud({
                params: params,
                body: body,
                config: {
                    timeout: 5000
                },
                disableNoConfigTests: true,
                callback: callback,
                resolve: resolve,
                reject: reject
            });
            after(function () {
                mockery.deregisterMock('./util/http.client');
                mockery.disable();
            });
        });

        describe('should default to DEFAULT_XHR_TIMEOUT of 3000', function () {
            before(function () {
                mockery.registerMock('./util/http.client', {
                    get: function (url, headers, config, callback) {
                        expect(config.xhrTimeout).to.equal(3000);
                        REST.get(url, headers, config, callback);
                    },
                    post : function (url, headers, body, config, callback) {
                        expect(config.xhrTimeout).to.equal(3000);
                        REST.post(url, headers, body, config, callback);
                    }
                });
                mockery.enable({
                    useCleanCache: true,
                    warnOnUnregistered: false
                });
                Fetcher = require('../../../libs/fetcher.client');
                this.fetcher = new Fetcher({
                    context: context
                });
            });
            testCrud(params, body, config, callback, resolve, reject);
            after(function () {
                mockery.deregisterMock('./util/http.client');
                mockery.disable();
            });
        });
    });

    describe('Context Picker', function () {
        var ctx = lodash.assign({random: 'randomnumber'}, context);
        before(function () {
            validateXhr = function (req) {
                if (req.method === 'GET') {
                    expect(req.url).to.contain(DEFAULT_XHR_PATH + '/' + resource);
                    expect(req.url).to.contain('?_csrf=' + ctx._csrf);
                    expect(req.url).to.not.contain('random=' + ctx.random);
                    expect(req.url).to.contain('returnMeta=true');
                } else if (req.method === 'POST') {
                    expect(req.url).to.equal(DEFAULT_XHR_PATH + '?_csrf=' +
                        ctx._csrf + '&random=' + ctx.random);
                }
            };
        });
        after(function () {
            validateXhr = null;
        });

        describe('Function', function () {
            before(function () {
                this.fetcher = new Fetcher({
                    context: ctx,
                    contextPicker: {
                        GET: function getContextPicker(value, key) {
                            if (key === 'random') {
                                return false;
                            }
                            return true;
                        }
                    }
                });
            });

            testCrud(params, body, config, callback, resolve, reject);
        });

        describe('Property Name', function () {
            before(function () {
                this.fetcher = new Fetcher({
                    context: ctx,
                    contextPicker: {
                        GET: '_csrf'
                    }
                });
            });

            testCrud(params, body, config, callback, resolve, reject);
        });

        describe('Property Names', function () {
            before(function () {
                this.fetcher = new Fetcher({
                    context: ctx,
                    contextPicker: {
                        GET: ['_csrf']
                    }
                });
            });

            testCrud(params, body, config, callback, resolve, reject);
        });
    });

    describe('Custom request headers', function () {
        var VERSION = '1.0.0';

        describe('should be configurable globally', function () {
            before(function () {
                mockery.registerMock('./util/http.client', {
                    get: function (url, headers, config, callback) {
                        expect(headers['X-APP-VERSION']).to.equal(VERSION);
                        REST.get(url, headers, config, callback);
                    },
                    post: function (url, headers, body, config, callback) {
                        expect(headers['X-APP-VERSION']).to.equal(VERSION);
                        REST.post(url, headers, body, config, callback);
                    }
                });
                mockery.enable({
                    useCleanCache: true,
                    warnOnUnregistered: false
                });
                Fetcher = require('../../../libs/fetcher.client');
                this.fetcher = new Fetcher({
                    context: context,
                    headers: {
                        'X-APP-VERSION': VERSION
                    }
                });
            });
            testCrud(params, body, config, callback, resolve, reject);
            after(function () {
                mockery.deregisterMock('./util/http.client');
                mockery.disable();
            });
        });

        describe('should be configurable per request', function () {
            before(function () {
                mockery.registerMock('./util/http.client', {
                    get: function (url, headers, config, callback) {
                        expect(headers['X-APP-VERSION']).to.equal(VERSION);
                        REST.get(url, headers, config, callback);
                    },
                    post: function (url, headers, body, config, callback) {
                        expect(headers['X-APP-VERSION']).to.equal(VERSION);
                        REST.post(url, headers, body, config, callback);
                    }
                });
                mockery.enable({
                    useCleanCache: true,
                    warnOnUnregistered: false
                });
                Fetcher = require('../../../libs/fetcher.client');
                this.fetcher = new Fetcher({
                    context: context
                });
            });
            var customConfig = {
                headers: {
                    'X-APP-VERSION': VERSION
                }
            };
            testCrud({
                disableNoConfigTests: true,
                params: params,
                body: body,
                config: customConfig,
                callback: callback,
                resolve: resolve,
                reject: reject
            });
            after(function () {
                mockery.deregisterMock('./util/http.client');
                mockery.disable();
            });
        });
    });


    describe('Utils', function () {
        it('should able to update options', function () {
            var fetcher = new Fetcher({
                context: {
                    _csrf: 'stuff'
                },
                xhrTimeout: 1000
            });
            fetcher.updateOptions({
                context: {
                    lang : 'en-US',
                },
                xhrTimeout: 1500
            });
            expect(fetcher.options.xhrTimeout).to.equal(1500);
            // new context should be merged
            expect(fetcher.options.context._csrf).to.equal('stuff');
            expect(fetcher.options.context.lang).to.equal('en-US');
        });
    });
});
