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

describe('Client Fetcher', function () {

    describe('DEFAULT', function () {
        before(function () {
            this.fetcher = new Fetcher({
                context: context
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
        testCrud(params, body, config, callback, resolve, reject);
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
        })
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
