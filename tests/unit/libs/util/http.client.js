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
            callback(null, mockResponse, mockBody);
        });
        http = require('../../../../libs/util/http.client.js');
    });

    after(function() {
        mockBody = '';
        mockery.deregisterAll();
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
                expect(options.timeout).to.equal(3000);
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
                expect(options.timeout).to.equal(3000);
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
                expect(options.timeout).to.equal(3000);
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
                expect(options.timeout).to.equal(3000);
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
                expect(options.timeout).to.equal(3000);
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
});
