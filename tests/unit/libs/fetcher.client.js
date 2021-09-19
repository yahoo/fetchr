/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

'use strict';

const fetchMock = require('fetch-mock');
var expect = require('chai').expect;
var mockery = require('mockery');
var sinon = require('sinon');
var supertest = require('supertest');

var Fetcher = require('../../../libs/fetcher.client');
var defaultConstructGetUri = require('../../../libs/util/defaultConstructGetUri');
var REST = require('../../../libs/util/http.client');
var testCrud = require('../../util/testCrud');
var defaultOptions = require('../../util/defaultOptions');

// APP
var defaultApp = require('../../mock/mockApp');
var DEFAULT_PATH = defaultApp.DEFAULT_PATH;
// CORS
var corsApp = require('../../mock/mockCorsApp');
var corsPath = corsApp.corsPath;

var validateRequest = null;

function handleFakeRequest(a, b, request) {
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
    return supertest(app)
        [method](url)
        .set(request.headers.entries())
        .send(request.body ? JSON.parse(request.body.toString()) : undefined)
        .then(function (res) {
            if (res.error) {
                // fetcher error
                return {
                    status: res.error.status || 500,
                    body: res.error.text,
                };
            }
            validateRequest && validateRequest(request);
            return {
                status: res.status,
                headers: res.headers,
                body: res.text,
            };
        })
        .catch((err) => {
            // superagent error
            return {
                status: 500,
                throws: err,
            };
        });
}

fetchMock.mock('*', handleFakeRequest);

var context = { _csrf: 'stuff' };
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
    after(() => {
        fetchMock.reset();
    });

    describe('DEFAULT', function () {
        before(function () {
            this.fetcher = new Fetcher({
                context: context,
                statsCollector: statsCollector,
            });
            validateRequest = function (req) {
                if (req.method === 'GET') {
                    expect(req.url).to.contain(DEFAULT_PATH + '/' + resource);
                    expect(req.url).to.contain('?_csrf=' + context._csrf);
                    expect(req.url).to.contain('returnMeta=true');
                } else if (req.method === 'POST') {
                    expect(req.url).to.equal(
                        DEFAULT_PATH + '?_csrf=' + context._csrf
                    );
                }
            };
        });
        beforeEach(function () {
            stats = null;
        });
        testCrud(params, body, config, callbackWithStats, resolve, reject);
        after(function () {
            validateRequest = null;
        });
    });

    describe('CORS', function () {
        before(function () {
            validateRequest = function (req) {
                if (req.method === 'GET') {
                    expect(req.url).to.contain(corsPath);
                    expect(req.url).to.contain('_csrf=' + context._csrf);
                    expect(req.url).to.contain('returnMeta=true');
                } else if (req.method === 'POST') {
                    expect(req.url).to.contain(
                        corsPath + '/?_csrf=' + context._csrf
                    );
                }
            };
            this.fetcher = new Fetcher({
                context: Object.assign({ cors: true }, context),
                corsPath: corsPath,
            });
        });
        testCrud({
            params: params,
            body: body,
            config: { cors: true },
            disableNoConfigTests: true,
            callback: callback,
            resolve: resolve,
            reject: reject,
        });
        after(function () {
            validateRequest = null;
        });
    });

    describe('request', function () {
        before(function () {
            this.fetcher = new Fetcher({
                context: context,
            });
        });

        it('should return request object when calling end w/ callback', function (done) {
            var operation = 'create';
            var request = this.fetcher[operation](resource)
                .params(params)
                .body(body)
                .clientConfig(config)
                .end(
                    callback(operation, function (err) {
                        if (err) {
                            done(err);
                            return;
                        }
                        expect(request.abort).to.exist;
                        done();
                    })
                );
        });
        it('should be able to abort when calling end w/ callback', function () {
            var operation = 'create';
            var request = this.fetcher[operation](resource)
                .params(params)
                .body(body)
                .clientConfig(config)
                .end(
                    callback(operation, function (err) {
                        if (err) {
                            // in this case, an error is good
                            // we want the error to be thrown then request is aborted
                            // done();
                        }
                    })
                );
            expect(request.abort).to.exist;
            request.abort();
        });
    });

    describe('Timeout', function () {
        describe('should be configurable globally', function () {
            before(function () {
                mockery.registerMock('./util/http.client', {
                    get: function (url, headers, config, callback) {
                        expect(config.xhrTimeout).to.equal(4000);
                        REST.get(url, headers, config, callback);
                    },
                    post: function (url, headers, body, config, callback) {
                        expect(config.xhrTimeout).to.equal(4000);
                        REST.post(url, headers, body, config, callback);
                    },
                });
                mockery.enable({
                    useCleanCache: true,
                    warnOnUnregistered: false,
                });
                Fetcher = require('../../../libs/fetcher.client');
                this.fetcher = new Fetcher({
                    context: context,
                    xhrTimeout: 4000,
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
                    post: function (url, headers, body, config, callback) {
                        expect(config.xhrTimeout).to.equal(4000);
                        expect(config.timeout).to.equal(5000);
                        REST.post(url, headers, body, config, callback);
                    },
                });
                mockery.enable({
                    useCleanCache: true,
                    warnOnUnregistered: false,
                });
                Fetcher = require('../../../libs/fetcher.client');
                this.fetcher = new Fetcher({
                    context: context,
                    xhrTimeout: 4000,
                });
            });
            testCrud({
                params: params,
                body: body,
                config: {
                    timeout: 5000,
                },
                disableNoConfigTests: true,
                callback: callback,
                resolve: resolve,
                reject: reject,
            });
            after(function () {
                mockery.deregisterMock('./util/http.client');
                mockery.disable();
            });
        });

        describe('should default to DEFAULT_TIMEOUT of 3000', function () {
            before(function () {
                mockery.registerMock('./util/http.client', {
                    get: function (url, headers, config, callback) {
                        expect(config.xhrTimeout).to.equal(3000);
                        REST.get(url, headers, config, callback);
                    },
                    post: function (url, headers, body, config, callback) {
                        expect(config.xhrTimeout).to.equal(3000);
                        REST.post(url, headers, body, config, callback);
                    },
                });
                mockery.enable({
                    useCleanCache: true,
                    warnOnUnregistered: false,
                });
                Fetcher = require('../../../libs/fetcher.client');
                this.fetcher = new Fetcher({
                    context: context,
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
        var ctx = Object.assign({ random: 'randomnumber' }, context);
        before(function () {
            validateRequest = function (req) {
                if (req.method === 'GET') {
                    expect(req.url).to.contain(DEFAULT_PATH + '/' + resource);
                    expect(req.url).to.contain('?_csrf=' + ctx._csrf);
                    expect(req.url).to.not.contain('random=' + ctx.random);
                    expect(req.url).to.contain('returnMeta=true');
                } else if (req.method === 'POST') {
                    expect(req.url).to.equal(
                        DEFAULT_PATH +
                            '?_csrf=' +
                            ctx._csrf +
                            '&random=' +
                            ctx.random
                    );
                }
            };
        });
        after(function () {
            validateRequest = null;
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
                        },
                    },
                });
            });

            testCrud(params, body, config, callback, resolve, reject);
        });

        describe('Property Name', function () {
            before(function () {
                this.fetcher = new Fetcher({
                    context: ctx,
                    contextPicker: {
                        GET: '_csrf',
                    },
                });
            });

            testCrud(params, body, config, callback, resolve, reject);
        });

        describe('Property Names', function () {
            before(function () {
                this.fetcher = new Fetcher({
                    context: ctx,
                    contextPicker: {
                        GET: ['_csrf'],
                    },
                });
            });

            testCrud(params, body, config, callback, resolve, reject);
        });
    });

    describe('Custom constructGetUri', () => {
        it('is called correctly', () => {
            const fetcher = new Fetcher({});
            const constructGetUri = sinon
                .stub()
                .callsFake(defaultConstructGetUri);

            return fetcher
                .read('mock_service', { foo: 'bar' }, { constructGetUri })
                .then(() => {
                    sinon.assert.calledOnceWithExactly(
                        constructGetUri,
                        '/api',
                        'mock_service',
                        { foo: 'bar' },
                        { constructGetUri },
                        {}
                    );
                });
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
                    },
                });
                mockery.enable({
                    useCleanCache: true,
                    warnOnUnregistered: false,
                });
                Fetcher = require('../../../libs/fetcher.client');
                this.fetcher = new Fetcher({
                    context: context,
                    headers: {
                        'X-APP-VERSION': VERSION,
                    },
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
                    },
                });
                mockery.enable({
                    useCleanCache: true,
                    warnOnUnregistered: false,
                });
                Fetcher = require('../../../libs/fetcher.client');
                this.fetcher = new Fetcher({
                    context: context,
                });
            });
            var customConfig = {
                headers: {
                    'X-APP-VERSION': VERSION,
                },
            };
            testCrud({
                disableNoConfigTests: true,
                params: params,
                body: body,
                config: customConfig,
                callback: callback,
                resolve: resolve,
                reject: reject,
            });
            after(function () {
                mockery.deregisterMock('./util/http.client');
                mockery.disable();
            });
        });
    });

    describe('updateOptions', function () {
        it('replaces all non mergeable options', function () {
            const f1 = () => {};
            const f2 = () => {};

            const fetcher = new Fetcher({
                corsPath: '/cors-path-1',
                statsCollector: f1,
                xhrPath: '/path-1',
                xhrTimeout: 1000,
            });

            fetcher.updateOptions({
                corsPath: '/cors-path-2',
                statsCollector: f2,
                xhrPath: '/path-2',
                xhrTimeout: 1500,
            });

            expect(fetcher.options.corsPath).to.equal('/cors-path-2');
            expect(fetcher.options.statsCollector).to.equal(f2);
            expect(fetcher.options.xhrPath).to.equal('/path-2');
            expect(fetcher.options.xhrTimeout).to.equal(1500);
        });

        it('merges context values', function () {
            const fetcher = new Fetcher({
                context: { a: 'a' },
            });

            fetcher.updateOptions({
                context: { b: 'b' },
            });

            expect(fetcher.options.context).to.deep.equal({
                a: 'a',
                b: 'b',
            });
        });

        describe('contextPicker', () => {
            const f1 = () => null;
            const f2 = () => null;

            it('keeps former contextPicker', () => {
                const fetcher = new Fetcher({
                    contextPicker: { GET: 'a' },
                });

                fetcher.updateOptions({});

                expect(fetcher.options.contextPicker).to.deep.equal({
                    GET: 'a',
                });
            });

            it('sets new contextPicker', () => {
                const fetcher = new Fetcher({});

                fetcher.updateOptions({
                    contextPicker: { POST: 'b' },
                });

                expect(fetcher.options.contextPicker).to.deep.equal({
                    POST: 'b',
                });
            });

            it('joins former and new contextPicker', () => {
                const fetcher = new Fetcher({
                    contextPicker: { GET: 'a' },
                });

                fetcher.updateOptions({
                    contextPicker: { POST: 'b' },
                });

                expect(fetcher.options.contextPicker).to.deep.equal({
                    GET: 'a',
                    POST: 'b',
                });
            });

            it('replaces string with string', () => {
                const fetcher = new Fetcher({
                    contextPicker: { GET: 'a' },
                });

                fetcher.updateOptions({
                    contextPicker: { GET: 'b' },
                });

                expect(fetcher.options.contextPicker).to.deep.equal({
                    GET: 'b',
                });
            });

            it('replaces string with array', () => {
                const fetcher = new Fetcher({
                    contextPicker: { GET: 'a' },
                });

                fetcher.updateOptions({
                    contextPicker: { GET: ['b'] },
                });

                expect(fetcher.options.contextPicker).to.deep.equal({
                    GET: ['b'],
                });
            });

            it('replaces string with function', () => {
                const fetcher = new Fetcher({
                    contextPicker: { GET: 'a' },
                });

                fetcher.updateOptions({
                    contextPicker: { GET: f2 },
                });

                expect(fetcher.options.contextPicker).to.deep.equal({
                    GET: f2,
                });
            });

            it('replaces array with string', () => {
                const fetcher = new Fetcher({
                    contextPicker: { GET: ['a'] },
                });

                fetcher.updateOptions({
                    contextPicker: { GET: 'b' },
                });

                expect(fetcher.options.contextPicker).to.deep.equal({
                    GET: 'b',
                });
            });

            it('merges array with array', () => {
                const fetcher = new Fetcher({
                    contextPicker: { GET: ['a'] },
                });

                fetcher.updateOptions({
                    contextPicker: { GET: ['b'] },
                });

                expect(fetcher.options.contextPicker).to.deep.equal({
                    GET: ['a', 'b'],
                });
            });

            it('replaces array with function', () => {
                const fetcher = new Fetcher({
                    contextPicker: { GET: ['a'] },
                });

                fetcher.updateOptions({
                    contextPicker: { GET: f2 },
                });

                expect(fetcher.options.contextPicker).to.deep.equal({
                    GET: f2,
                });
            });

            it('replaces function with string', () => {
                const fetcher = new Fetcher({
                    contextPicker: { GET: f1 },
                });

                fetcher.updateOptions({
                    contextPicker: { GET: 'b' },
                });

                expect(fetcher.options.contextPicker).to.deep.equal({
                    GET: 'b',
                });
            });

            it('replaces function with array', () => {
                const fetcher = new Fetcher({
                    contextPicker: { GET: f1 },
                });

                fetcher.updateOptions({
                    contextPicker: { GET: ['b'] },
                });

                expect(fetcher.options.contextPicker).to.deep.equal({
                    GET: ['b'],
                });
            });

            it('replaces function with function', () => {
                const fetcher = new Fetcher({
                    contextPicker: { GET: f1 },
                });

                fetcher.updateOptions({
                    contextPicker: { GET: f2 },
                });

                expect(fetcher.options.contextPicker).to.deep.equal({
                    GET: f2,
                });
            });
        });
    });
});
