/**
 * Copyright 2015, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

'use strict';

const fetchMock = require('fetch-mock');
const { expect } = require('chai');
const sinon = require('sinon');
const http = require('../../../../libs/util/http.client.js');

describe('Client HTTP', function () {
    let responseStatus;
    let mockBody;

    after(function () {
        fetchMock.reset();
    });

    afterEach(function () {
        fetchMock.resetHistory();
        fetchMock.resetBehavior();
    });

    describe('#Successful requests', function () {
        beforeEach(function () {
            responseStatus = 200;
            mockBody = 'BODY';
        });

        it('GET', function (done) {
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            http.get('/url', { 'X-Foo': 'foo' }, {}, function (err, response) {
                expect(fetchMock.calls()).to.have.lengthOf(1);
                const options = fetchMock.lastCall().request;
                expect(options.url).to.equal('/url');
                expect(options.headers.get('X-Requested-With')).to.equal(
                    'XMLHttpRequest'
                );
                expect(options.headers.get('X-Foo')).to.equal('foo');
                expect(options.method).to.equal('GET');
                expect(err).to.equal(null);
                expect(response.statusCode).to.equal(200);
                expect(response.responseText).to.equal('BODY');
                done();
            });
        });

        it('POST', function (done) {
            fetchMock.post('/url', {
                body: mockBody,
                status: responseStatus,
            });

            http.post(
                '/url',
                { 'X-Foo': 'foo' },
                { data: 'data' },
                {},
                function () {
                    expect(fetchMock.calls()).to.have.lengthOf(1);
                    const options = fetchMock.lastCall().request;
                    expect(options.url).to.equal('/url');
                    expect(options.headers.get('X-Requested-With')).to.equal(
                        'XMLHttpRequest'
                    );
                    expect(options.headers.get('X-Foo')).to.equal('foo');
                    expect(options.method).to.equal('POST');
                    expect(options.body.toString()).to.eql('{"data":"data"}');
                    done();
                }
            );
        });
    });

    describe('#Successful CORS requests', function () {
        beforeEach(function () {
            responseStatus = 200;
            mockBody = 'BODY';
            sinon.spy(global, 'Request');
        });

        afterEach(() => {
            Request.restore();
        });

        it('GET', function (done) {
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            http.get(
                '/url',
                { 'X-Foo': 'foo' },
                { cors: true, withCredentials: true },
                function (err, response) {
                    expect(fetchMock.calls()).to.have.lengthOf(1);
                    const options = fetchMock.lastCall().request;
                    expect(options.url).to.equal('/url');
                    expect(options.headers).to.not.have.property(
                        'X-Requested-With'
                    );
                    expect(options.headers.get('X-Foo')).to.equal('foo');
                    expect(options.method).to.equal('GET');
                    expect(err).to.equal(null);
                    expect(response.statusCode).to.equal(200);
                    expect(response.responseText).to.equal('BODY');

                    sinon.assert.calledWith(
                        Request,
                        sinon.match.string,
                        sinon.match({ credentials: 'include' })
                    );

                    done();
                }
            );
        });

        it('POST', function (done) {
            fetchMock.post('/url', {
                body: mockBody,
                status: responseStatus,
            });

            http.post(
                '/url',
                { 'X-Foo': 'foo' },
                { data: 'data' },
                { cors: true },
                function () {
                    expect(fetchMock.calls()).to.have.lengthOf(1);
                    const options = fetchMock.lastCall().request;
                    expect(options.url).to.equal('/url');
                    expect(options.headers).to.not.have.property(
                        'X-Requested-With'
                    );
                    expect(options.headers.get('X-Foo')).to.equal('foo');
                    expect(options.method).to.equal('POST');
                    expect(options.body.toString()).to.eql('{"data":"data"}');

                    sinon.assert.calledWith(
                        Request,
                        sinon.match.string,
                        sinon.match({ credentials: 'same-origin' })
                    );

                    done();
                }
            );
        });
    });

    describe('#400 requests', function () {
        beforeEach(function () {
            responseStatus = 400;
        });

        it('GET with empty response', function (done) {
            mockBody = '';
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            http.get('/url', { 'X-Foo': 'foo' }, {}, function (err) {
                try {
                    expect(err.message).to.equal('');
                    expect(err.statusCode).to.equal(400);
                    expect(err.body).to.equal('');
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });

        it('GET with JSON response containing message attribute', function (done) {
            mockBody = '{"message":"some body content"}';
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            http.get('/url', { 'X-Foo': 'foo' }, {}, function (err) {
                expect(err.message).to.equal('some body content');
                expect(err.statusCode).to.equal(400);
                expect(err.body).to.deep.equal({
                    message: 'some body content',
                });
                done();
            });
        });

        it('GET with JSON response not containing message attribute', function (done) {
            mockBody = '{"other":"some body content"}';
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            http.get('/url', { 'X-Foo': 'foo' }, {}, function (err) {
                expect(err.message).to.equal(mockBody);
                expect(err.statusCode).to.equal(400);
                expect(err.body).to.deep.equal({
                    other: 'some body content',
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
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            http.get('/url', { 'X-Foo': 'foo' }, {}, function (err) {
                expect(err.message).to.equal(mockBody);
                expect(err.statusCode).to.equal(400);
                expect(err.body).to.equal(mockBody);
                done();
            });
        });
    });

    describe('#Retry', function () {
        beforeEach(function () {
            mockBody = 'BODY';

            responseStatus = 408;
        });

        const expectRequestsToBeEqual = (req1, req2) => {
            expect(req1.request.url).to.equal(req2.request.url);
            expect(req1.request.method).to.equal(req2.request.method);
            expect(
                Object.fromEntries(req1.request.headers.entries())
            ).to.deep.equal(Object.fromEntries(req2.request.headers.entries()));
            expect(req1.request.body).to.equal(req2.request.body);
        };

        it('GET with no retry', function (done) {
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            http.get('/url', { 'X-Foo': 'foo' }, {}, function (err) {
                const options = fetchMock.lastCall().request;
                expect(fetchMock.calls()).to.have.lengthOf(1);
                expect(options.url).to.equal('/url');
                expect(options.headers.get('X-Requested-With')).to.equal(
                    'XMLHttpRequest'
                );
                expect(options.headers.get('X-Foo')).to.equal('foo');
                expect(options.method).to.equal('GET');
                expect(err.message).to.equal('BODY');
                expect(err.statusCode).to.equal(408);
                expect(err.body).to.equal('BODY');
                done();
            });
        });

        it('GET with retry', function (done) {
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            http.get(
                '/url',
                { 'X-Foo': 'foo' },
                {
                    retry: {
                        interval: 200,
                        maxRetries: 1,
                    },
                },
                function (err) {
                    expect(fetchMock.calls()).to.have.lengthOf(2);
                    const options = fetchMock.lastCall().request;
                    expect(options.url).to.equal('/url');
                    expect(options.headers.get('X-Requested-With')).to.equal(
                        'XMLHttpRequest'
                    );
                    expect(options.headers.get('X-Foo')).to.equal('foo');
                    expect(options.method).to.equal('GET');
                    expect(err.message).to.equal('BODY');
                    expect(err.statusCode).to.equal(408);
                    expect(err.body).to.equal('BODY');

                    const [req1, req2] = fetchMock.calls();
                    expectRequestsToBeEqual(req1, req2);

                    done();
                }
            );
        });

        it('GET with retry and custom status code', function (done) {
            responseStatus = 502;
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            http.get(
                '/url',
                { 'X-Foo': 'foo' },
                {
                    retry: {
                        interval: 20,
                        maxRetries: 1,
                        statusCodes: [502],
                    },
                },
                function () {
                    expect(fetchMock.calls()).to.have.lengthOf(2);

                    const [req1, req2] = fetchMock.calls();
                    expectRequestsToBeEqual(req1, req2);

                    done();
                }
            );
        });
    });

    describe('#Timeout', function () {
        var config;

        beforeEach(function () {
            sinon.spy(global, 'setTimeout');

            responseStatus = 200;
            mockBody = 'BODY';
        });

        afterEach(() => {
            setTimeout.restore();
        });

        describe('#No timeout set for individual call', function () {
            beforeEach(function () {
                config = { xhrTimeout: 3000 };
            });

            it('should use xhrTimeout for GET', function (done) {
                fetchMock.get('/url', {
                    body: mockBody,
                    status: responseStatus,
                });

                http.get('/url', { 'X-Foo': 'foo' }, config, function () {
                    sinon.assert.calledWith(setTimeout, sinon.match.func, 3000);
                    done();
                });
            });

            it('should use xhrTimeout for POST', function (done) {
                fetchMock.post('/url', {
                    body: mockBody,
                    status: responseStatus,
                });

                http.post(
                    '/url',
                    { 'X-Foo': 'foo' },
                    { data: 'data' },
                    config,
                    function () {
                        sinon.assert.calledWith(
                            setTimeout,
                            sinon.match.func,
                            3000
                        );
                        done();
                    }
                );
            });
        });

        describe('#Timeout set for individual call', function () {
            beforeEach(function () {
                config = { xhrTimeout: 3000, timeout: 6000 };
            });

            it('should override default xhrTimeout for GET', function (done) {
                fetchMock.get('/url', {
                    body: mockBody,
                    status: responseStatus,
                });

                http.get('/url', { 'X-Foo': 'foo' }, config, function () {
                    sinon.assert.calledWith(setTimeout, sinon.match.func, 6000);
                    done();
                });
            });

            it('should override default xhrTimeout for POST', function (done) {
                fetchMock.post('/url', {
                    body: mockBody,
                    status: responseStatus,
                });

                http.post(
                    '/url',
                    { 'X-Foo': 'foo' },
                    { data: 'data' },
                    config,
                    function () {
                        sinon.assert.calledWith(
                            setTimeout,
                            sinon.match.func,
                            6000
                        );
                        done();
                    }
                );
            });
        });
    });

    describe('request errors', function () {
        it('should pass-through any xhr error', function (done) {
            responseStatus = 0;
            fetchMock.get('/url', {
                throws: new Error('AnyError'),
                status: responseStatus,
            });

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
