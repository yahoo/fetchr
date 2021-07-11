/**
 * Copyright 2015, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

'use strict';

const { expect } = require('chai');
const mockery = require('mockery');

let http;
let xhrOptions;
let mockResponse;

let mockBody = '';
let mockError = null;

describe('Client HTTP', () => {
    before(() => {
        mockery.enable({
            useCleanCache: true,
            warnOnUnregistered: false,
        });
        mockery.resetCache();
        mockBody = '';
        mockery.registerMock('xhr', (options, callback) => {
            xhrOptions.push(options);
            callback(mockError, mockResponse, mockBody);
        });
        http = require('../../../../libs/util/http.client.js');
    });

    after(() => {
        mockBody = '';
        mockery.deregisterAll();
    });

    afterEach(() => {
        mockError = null;
    });

    describe('#Successful requests', () => {
        beforeEach(() => {
            mockResponse = {
                statusCode: 200,
            };
            mockBody = 'BODY';
            xhrOptions = [];
        });

        it('GET', (done) => {
            http.get('/url', { 'X-Foo': 'foo' }, {}, (err, response) => {
                expect(xhrOptions.length).to.equal(1);
                const options = xhrOptions[0];
                expect(options.url).to.equal('/url');
                expect(options.headers['X-Requested-With']).to.equal(
                    'XMLHttpRequest'
                );
                expect(options.headers['X-Foo']).to.equal('foo');
                expect(options.method).to.equal('GET');
                expect(err).to.equal(null);
                expect(response.statusCode).to.equal(200);
                expect(response.responseText).to.equal('BODY');
                done();
            });
        });

        it('POST', (done) => {
            http.post('/url', { 'X-Foo': 'foo' }, { data: 'data' }, {}, () => {
                expect(xhrOptions.length).to.equal(1);
                const options = xhrOptions[0];
                expect(options.url).to.equal('/url');
                expect(options.headers['X-Requested-With']).to.equal(
                    'XMLHttpRequest'
                );
                expect(options.headers['X-Foo']).to.equal('foo');
                expect(options.method).to.equal('POST');
                expect(options.body).to.eql('{"data":"data"}');
                done();
            });
        });
    });

    describe('#Successful CORS requests', () => {
        beforeEach(() => {
            mockResponse = {
                statusCode: 200,
            };
            mockBody = 'BODY';
            xhrOptions = [];
        });

        it('GET', (done) => {
            http.get(
                '/url',
                { 'X-Foo': 'foo' },
                { cors: true, withCredentials: true },
                (err, response) => {
                    expect(xhrOptions.length).to.equal(1);
                    const options = xhrOptions[0];
                    expect(options.url).to.equal('/url');
                    expect(options.headers).to.not.have.property(
                        'X-Requested-With'
                    );
                    expect(options.headers['X-Foo']).to.equal('foo');
                    expect(options.method).to.equal('GET');
                    expect(options.withCredentials).to.equal(true);
                    expect(err).to.equal(null);
                    expect(response.statusCode).to.equal(200);
                    expect(response.responseText).to.equal('BODY');
                    done();
                }
            );
        });

        it('POST', (done) => {
            http.post(
                '/url',
                { 'X-Foo': 'foo' },
                { data: 'data' },
                { cors: true },
                () => {
                    expect(xhrOptions.length).to.equal(1);
                    const options = xhrOptions[0];
                    expect(options.url).to.equal('/url');
                    expect(options.headers).to.not.have.property(
                        'X-Requested-With'
                    );
                    expect(options.headers['X-Foo']).to.equal('foo');
                    expect(options.method).to.equal('POST');
                    expect(options.body).to.eql('{"data":"data"}');
                    done();
                }
            );
        });
    });

    describe('#400 requests', () => {
        beforeEach(() => {
            xhrOptions = [];
            mockResponse = {
                statusCode: 400,
            };
        });

        it('GET with no response', (done) => {
            mockBody = undefined;
            http.get('/url', { 'X-Foo': 'foo' }, {}, (err) => {
                expect(err.message).to.equal('Error 400');
                expect(err.statusCode).to.equal(400);
                expect(err.body).to.equal(undefined);
                done();
            });
        });

        it('GET with empty response', (done) => {
            mockBody = '';
            http.get('/url', { 'X-Foo': 'foo' }, {}, (err) => {
                expect(err.message).to.equal('');
                expect(err.statusCode).to.equal(400);
                expect(err.body).to.equal('');
                done();
            });
        });

        it('GET with JSON response containing message attribute', (done) => {
            mockBody = '{"message":"some body content"}';
            http.get('/url', { 'X-Foo': 'foo' }, {}, (err) => {
                expect(err.message).to.equal('some body content');
                expect(err.statusCode).to.equal(400);
                expect(err.body).to.deep.equal({
                    message: 'some body content',
                });
                done();
            });
        });

        it('GET with JSON response not containing message attribute', (done) => {
            mockBody = '{"other":"some body content"}';
            http.get('/url', { 'X-Foo': 'foo' }, {}, (err) => {
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
        it('GET with plain text', (done) => {
            mockBody = 'Bad Request';
            http.get('/url', { 'X-Foo': 'foo' }, {}, (err) => {
                expect(err.message).to.equal(mockBody);
                expect(err.statusCode).to.equal(400);
                expect(err.body).to.equal(mockBody);
                done();
            });
        });
    });

    describe('#Retry', () => {
        beforeEach(() => {
            xhrOptions = [];
            mockBody = 'BODY';
            mockResponse = {
                statusCode: 408,
            };
        });

        it('GET with no retry', (done) => {
            http.get('/url', { 'X-Foo': 'foo' }, {}, (err) => {
                const options = xhrOptions[0];
                expect(xhrOptions.length).to.equal(1);
                expect(options.url).to.equal('/url');
                expect(options.headers['X-Requested-With']).to.equal(
                    'XMLHttpRequest'
                );
                expect(options.headers['X-Foo']).to.equal('foo');
                expect(options.method).to.equal('GET');
                expect(err.message).to.equal('BODY');
                expect(err.statusCode).to.equal(408);
                expect(err.body).to.equal('BODY');
                done();
            });
        });

        it('GET with retry', (done) => {
            http.get(
                '/url',
                { 'X-Foo': 'foo' },
                {
                    timeout: 2000,
                    retry: {
                        interval: 200,
                        maxRetries: 1,
                    },
                },
                (err) => {
                    expect(xhrOptions.length).to.equal(2);
                    const options = xhrOptions[0];
                    expect(options.url).to.equal('/url');
                    expect(options.headers['X-Requested-With']).to.equal(
                        'XMLHttpRequest'
                    );
                    expect(options.headers['X-Foo']).to.equal('foo');
                    expect(options.method).to.equal('GET');
                    expect(options.timeout).to.equal(2000);
                    expect(err.message).to.equal('BODY');
                    expect(err.statusCode).to.equal(408);
                    expect(err.body).to.equal('BODY');
                    expect(xhrOptions[0]).to.eql(xhrOptions[1]);
                    done();
                }
            );
        });

        it('GET with retry and custom status code', function (done) {
            mockResponse = { statusCode: 502 };

            http.get(
                '/url',
                { 'X-Foo': 'foo' },
                {
                    timeout: 2000,
                    retry: {
                        interval: 20,
                        maxRetries: 1,
                        statusCodes: [502],
                    },
                },
                function () {
                    expect(xhrOptions.length).to.equal(2);
                    expect(xhrOptions[0]).to.eql(xhrOptions[1]);
                    done();
                }
            );
        });
    });

    describe('#Timeout', () => {
        let config;

        beforeEach(() => {
            mockResponse = {
                statusCode: 200,
            };
            mockBody = 'BODY';
            xhrOptions = [];
        });

        describe('#No timeout set for individual call', () => {
            beforeEach(() => {
                config = { xhrTimeout: 3000 };
            });

            it('should use xhrTimeout for GET', (done) => {
                http.get('/url', { 'X-Foo': 'foo' }, config, () => {
                    const options = xhrOptions[0];
                    expect(options.timeout).to.equal(3000);
                    done();
                });
            });

            it('should use xhrTimeout for POST', (done) => {
                http.post(
                    '/url',
                    { 'X-Foo': 'foo' },
                    { data: 'data' },
                    config,
                    () => {
                        const options = xhrOptions[0];
                        expect(options.timeout).to.equal(3000);
                        done();
                    }
                );
            });
        });

        describe('#Timeout set for individual call', () => {
            beforeEach(() => {
                config = { xhrTimeout: 3000, timeout: 6000 };
            });

            it('should override default xhrTimeout for GET', (done) => {
                http.get('/url', { 'X-Foo': 'foo' }, config, () => {
                    const options = xhrOptions[0];
                    expect(options.timeout).to.equal(6000);
                    done();
                });
            });

            it('should override default xhrTimeout for POST', (done) => {
                http.post(
                    '/url',
                    { 'X-Foo': 'foo' },
                    { data: 'data' },
                    config,
                    () => {
                        const options = xhrOptions[0];
                        expect(options.timeout).to.equal(6000);
                        done();
                    }
                );
            });
        });
    });

    describe('xhr errors', () => {
        it('should pass-through any xhr error', (done) => {
            mockError = new Error('AnyError');
            xhrOptions = [];
            mockResponse = { statusCode: 0, url: '/url' };

            http.get('/url', {}, { xhrTimeout: 42 }, (err, response) => {
                expect(response).to.equal(undefined);
                expect(err.message).to.equal('AnyError');
                expect(err.timeout).to.equal(42);
                expect(err.url).to.equal('/url');
                done();
            });
        });
    });
});
