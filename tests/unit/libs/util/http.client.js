/**
 * Copyright 2015, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
/*jshint expr:true*/
/*globals before,after,describe,it,beforeEach */
'use strict';

var expect = require('chai').expect;
var mockery = require('mockery');
var http;
var xhrOptions;
var mockResponse;
var mockBody = '';
var mockError = null;

describe('Client HTTP', function () {

    before(function () {
        mockery.enable({
            useCleanCache: true,
            warnOnUnregistered: false
        });
        mockery.resetCache();
        mockBody = '';
        mockery.registerMock('xhr', function mockXhr(options, callback) {
            xhrOptions.push(options);
            callback(mockError, mockResponse, mockBody);
        });
        http = require('../../../../libs/util/http.client.js');
    });

    after(function() {
        mockBody = '';
        mockery.deregisterAll();
    });

    afterEach(function () {
        mockError = null;
    });

    describe('#Successful requests', function () {
        beforeEach(function () {
            mockResponse = {
                statusCode: 200
            };
            mockBody = 'BODY';
            xhrOptions = [];
        });

        it('GET', function (done) {
            http.get('/url', {'X-Foo': 'foo'}, {}, function (err, response) {
                expect(xhrOptions.length).to.equal(1);
                var options = xhrOptions[0];
                expect(options.url).to.equal('/url');
                expect(options.headers['X-Requested-With']).to.equal('XMLHttpRequest');
                expect(options.headers['X-Foo']).to.equal('foo');
                expect(options.method).to.equal('GET');
                expect(err).to.equal(null);
                expect(response.statusCode).to.equal(200);
                expect(response.responseText).to.equal('BODY');
                done();
            });
        });

        it('PUT', function (done) {
            http.put('/url', {'X-Foo': 'foo'}, {data: 'data'}, {}, function () {
                expect(xhrOptions.length).to.equal(1);
                var options = xhrOptions[0];
                expect(options.url).to.equal('/url');
                expect(options.headers['X-Requested-With']).to.equal('XMLHttpRequest');
                expect(options.headers['X-Foo']).to.equal('foo');
                expect(options.method).to.equal('PUT');
                expect(options.body).to.eql('{"data":"data"}');
                done();
            });
        });

        it('POST', function (done) {
            http.post('/url', {'X-Foo': 'foo'}, {data: 'data'}, {}, function () {
                expect(xhrOptions.length).to.equal(1);
                var options = xhrOptions[0];
                expect(options.url).to.equal('/url');
                expect(options.headers['X-Requested-With']).to.equal('XMLHttpRequest');
                expect(options.headers['X-Foo']).to.equal('foo');
                expect(options.method).to.equal('POST');
                expect(options.body).to.eql('{"data":"data"}');
                done();
            });
        });

        it('DELETE', function (done) {
            http['delete']('/url', {'X-Foo': 'foo'}, {}, function () {
                expect(xhrOptions.length).to.equal(1);
                var options = xhrOptions[0];
                expect(options.url).to.equal('/url');
                expect(options.headers['X-Requested-With']).to.equal('XMLHttpRequest');
                expect(options.headers['X-Foo']).to.equal('foo');
                expect(options.method).to.equal('DELETE');
                done();
            });
        });
    });

    describe('#Successful CORS requests', function () {
        beforeEach(function () {
            mockResponse = {
                statusCode: 200
            };
            mockBody = 'BODY';
            xhrOptions = [];
        });

        it('GET', function (done) {
            http.get('/url', {'X-Foo': 'foo'}, {cors: true, withCredentials: true}, function (err, response) {
                expect(xhrOptions.length).to.equal(1);
                var options = xhrOptions[0];
                expect(options.url).to.equal('/url');
                expect(options.headers).to.not.have.property('X-Requested-With');
                expect(options.headers['X-Foo']).to.equal('foo');
                expect(options.method).to.equal('GET');
                expect(options.withCredentials).to.equal(true);
                expect(err).to.equal(null);
                expect(response.statusCode).to.equal(200);
                expect(response.responseText).to.equal('BODY');
                done();
            });
        });

        it('PUT', function (done) {
            http.put('/url', {'X-Foo': 'foo'}, {data: 'data'}, {cors: true}, function () {
                expect(xhrOptions.length).to.equal(1);
                var options = xhrOptions[0];
                expect(options.url).to.equal('/url');
                expect(options.headers).to.not.have.property('X-Requested-With');
                expect(options.headers['X-Foo']).to.equal('foo');
                expect(options.method).to.equal('PUT');
                expect(options.body).to.eql('{"data":"data"}');
                done();
            });
        });

        it('POST', function (done) {
            http.post('/url', {'X-Foo': 'foo'}, {data: 'data'}, {cors: true}, function () {
                expect(xhrOptions.length).to.equal(1);
                var options = xhrOptions[0];
                expect(options.url).to.equal('/url');
                expect(options.headers).to.not.have.property('X-Requested-With');
                expect(options.headers['X-Foo']).to.equal('foo');
                expect(options.method).to.equal('POST');
                expect(options.body).to.eql('{"data":"data"}');
                done();
            });
        });

        it('DELETE', function (done) {
            http['delete']('/url', {'X-Foo': 'foo'}, {cors: true}, function () {
                expect(xhrOptions.length).to.equal(1);
                var options = xhrOptions[0];
                expect(options.url).to.equal('/url');
                expect(options.headers).to.not.have.property('X-Requested-With');
                expect(options.headers['X-Foo']).to.equal('foo');
                expect(options.method).to.equal('DELETE');
                done();
            });
        });
    });

    describe('#400 requests', function () {
        beforeEach(function () {
            xhrOptions = [];
            mockResponse = {
                statusCode: 400
            };
        });

        it('GET with no response', function (done) {
            mockBody = undefined;
            http.get('/url', {'X-Foo': 'foo'}, {}, function (err, response, body) {
                expect(err.message).to.equal('Error 400');
                expect(err.statusCode).to.equal(400);
                expect(err.body).to.equal(undefined);
                done();
            });
        });

        it('GET with empty response', function (done) {
            mockBody = '';
            http.get('/url', {'X-Foo': 'foo'}, {}, function (err, response, body) {
                expect(err.message).to.equal('');
                expect(err.statusCode).to.equal(400);
                expect(err.body).to.equal('');
                done();
            });
        });

        it('GET with JSON response containing message attribute', function (done) {
            mockBody = '{"message":"some body content"}';
            http.get('/url', {'X-Foo': 'foo'}, {}, function (err, response, body) {
                expect(err.message).to.equal('some body content');
                expect(err.statusCode).to.equal(400);
                expect(err.body).to.deep.equal({
                    message: 'some body content'
                });
                done();
            });
        });

        it('GET with JSON response not containing message attribute', function (done) {
            mockBody = '{"other":"some body content"}';
            http.get('/url', {'X-Foo': 'foo'}, {}, function (err, response, body) {
                expect(err.message).to.equal(mockBody);
                expect(err.statusCode).to.equal(400);
                expect(err.body).to.deep.equal({
                    other: "some body content"
                });
                done();
            });
        });

        // Need to test plain text response
        // as some servers (e.g. node running in IIS)
        // may remove body content
        // and replace it with 'Bad Request'
        // if not configured to allow content throughput
        it('GET with plain text', function (done) {
            mockBody = 'Bad Request';
            http.get('/url', {'X-Foo': 'foo'}, {}, function (err, response, body) {
                expect(err.message).to.equal(mockBody);
                expect(err.statusCode).to.equal(400);
                expect(err.body).to.equal(mockBody);
                done();
            });
        });
    });

    describe('#408 requests', function () {
        beforeEach(function () {
            xhrOptions = [];
            mockBody = 'BODY';
            mockResponse = {
                statusCode: 408
            };
        });

        it('GET with no retry', function (done) {
            http.get('/url', {'X-Foo': 'foo'}, {}, function (err, response, body) {
                var options = xhrOptions[0];
                expect(xhrOptions.length).to.equal(1);
                expect(options.url).to.equal('/url');
                expect(options.headers['X-Requested-With']).to.equal('XMLHttpRequest');
                expect(options.headers['X-Foo']).to.equal('foo');
                expect(options.method).to.equal('GET');
                expect(err.message).to.equal('BODY');
                expect(err.statusCode).to.equal(408);
                expect(err.body).to.equal('BODY');
                done();
            });
        });

        it('GET with retry', function (done) {
            http.get('/url', {'X-Foo': 'foo'}, {
                timeout: 2000,
                retry: {
                    interval: 200,
                    max_retries: 1
                }
            }, function (err, response, body) {
                expect(xhrOptions.length).to.equal(2);
                var options = xhrOptions[0];
                expect(options.url).to.equal('/url');
                expect(options.headers['X-Requested-With']).to.equal('XMLHttpRequest');
                expect(options.headers['X-Foo']).to.equal('foo');
                expect(options.method).to.equal('GET');
                expect(options.timeout).to.equal(2000);
                expect(err.message).to.equal('BODY');
                expect(err.statusCode).to.equal(408);
                expect(err.body).to.equal('BODY');
                expect(xhrOptions[0]).to.eql(xhrOptions[1]);
                done();
            });
        });
    });

    describe('#Timeout', function () {
        var config;

        beforeEach(function () {
            mockResponse = {
                statusCode: 200
            };
            mockBody = 'BODY';
            xhrOptions = [];
        });

        describe('#No timeout set for individual call', function () {
            beforeEach(function () {
                config = {xhrTimeout: 3000};
            });

            it('should use xhrTimeout for GET', function (done) {
                http.get('/url', {'X-Foo': 'foo'}, config, function (err, response) {
                    var options = xhrOptions[0];
                    expect(options.timeout).to.equal(3000);
                    done();
                });
            });

            it('should use xhrTimeout for PUT', function (done) {
                http.put('/url', {'X-Foo': 'foo'}, {data: 'data'}, config, function () {
                    var options = xhrOptions[0];
                    expect(options.timeout).to.equal(3000);
                    done();
                });
            });

            it('should use xhrTimeout for POST', function (done) {
                http.post('/url', {'X-Foo': 'foo'}, {data: 'data'}, config, function () {
                    var options = xhrOptions[0];
                    expect(options.timeout).to.equal(3000);
                    done();
                });
            });

            it('should use xhrTimeout for DELETE', function (done) {
                http['delete']('/url', {'X-Foo': 'foo'}, config, function () {
                    var options = xhrOptions[0];
                    expect(options.timeout).to.equal(3000);
                    done();
                });
            });
        });

        describe('#Timeout set for individual call', function () {
            beforeEach(function () {
                config = {xhrTimeout: 3000, timeout: 6000};
            });

            it('should override default xhrTimeout for GET', function (done) {
                http.get('/url', {'X-Foo': 'foo'}, config, function (err, response) {
                    var options = xhrOptions[0];
                    expect(options.timeout).to.equal(6000);
                    done();
                });
            });

            it('should override default xhrTimeout for PUT', function (done) {
                http.put('/url', {'X-Foo': 'foo'}, {data: 'data'}, config, function () {
                    var options = xhrOptions[0];
                    expect(options.timeout).to.equal(6000);
                    done();
                });
            });

            it('should override default xhrTimeout for POST', function (done) {
                http.post('/url', {'X-Foo': 'foo'}, {data: 'data'}, config, function () {
                    var options = xhrOptions[0];
                    expect(options.timeout).to.equal(6000);
                    done();
                });
            });

            it('should override default xhrTimeout for DELETE', function (done) {
                http['delete']('/url', {'X-Foo': 'foo'}, config, function () {
                    var options = xhrOptions[0];
                    expect(options.timeout).to.equal(6000);
                    done();
                });
            });
        });
    });

    describe('xhr errors', function () {
        it('should pass-through any xhr error', function (done) {
            mockError = new Error('AnyError');
            xhrOptions = [];
            mockResponse = { statusCode: 0, url: '/url' };

            http.get('/url', {}, { xhrTimeout: 42 }, function (err, response) {
                expect(response).to.equal(undefined);
                expect(err.message).to.equal('AnyError');
                expect(err.timeout).to.equal(42);
                expect(err.url).to.equal('/url');

                done();
            });
        });
    });
});
