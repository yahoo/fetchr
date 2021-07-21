/**
 * Copyright 2015, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

'use strict';

const nock = require('nock');
const sinon = require('sinon');
const { expect } = require('chai');
const { JSDOM } = require('jsdom');

describe('http.client', () => {
    const url = 'https://example.com/';

    let http;
    let mockResponse;
    let mockBody;

    before(() => {
        const dom = new JSDOM('', { url });
        global.XMLHttpRequest = dom.window.XMLHttpRequest;
        global.window = dom.window;
        sinon.spy(global, 'XMLHttpRequest');
        http = require('../../../../libs/util/http.client.js');
    });

    after(() => {
        delete global.XMLHttpRequest;
        delete global.window;
    });

    beforeEach(() => {
        XMLHttpRequest.resetHistory();
    });

    describe('#Successful requests', () => {
        beforeEach(() => {
            mockResponse = { statusCode: 200 };
            mockBody = 'BODY';
        });

        it('GET', (done) => {
            nock(url)
                .get('/url')
                .matchHeader('x-foo', 'foo')
                .matchHeader('X-Requested-With', 'XMLHttpRequest')
                .reply(mockResponse.statusCode, mockBody);

            http.get('/url', { 'X-Foo': 'foo' }, {}, (err, response) => {
                expect(XMLHttpRequest.callCount).to.equal(1);
                expect(err).to.equal(null);
                expect(response.statusCode).to.equal(200);
                expect(response.responseText).to.equal('BODY');
                done();
            });
        });

        it('POST', (done) => {
            const body = { data: 'data' };

            nock(url)
                .post('/url', body)
                .matchHeader('x-foo', 'foo')
                .matchHeader('X-Requested-With', 'XMLHttpRequest')
                .reply(mockResponse.statusCode, mockBody);

            http.post('/url', { 'X-Foo': 'foo' }, body, {}, (err, response) => {
                expect(XMLHttpRequest.callCount).to.equal(1);
                expect(err).to.equal(null);
                expect(response.statusCode).to.equal(200);
                expect(response.responseText).to.equal('BODY');
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
        });

        it('GET', (done) => {
            nock(url, { badheaders: ['X-Requested-With', 'XMLHttpRequest'] })
                .get('/url')
                .matchHeader('x-foo', 'foo')
                .reply(mockResponse.statusCode, mockBody);

            http.get(
                '/url',
                { 'X-Foo': 'foo' },
                { cors: true, withCredentials: true },
                (err, response) => {
                    expect(XMLHttpRequest.callCount).to.equal(1);
                    expect(err).to.equal(null);
                    const options = response.rawRequest;
                    expect(options.withCredentials).to.equal(true);
                    expect(response.statusCode).to.equal(200);
                    expect(response.responseText).to.equal('BODY');
                    done();
                }
            );
        });

        it('POST', (done) => {
            const body = { data: 'data' };

            nock(url, { badheaders: ['X-Requested-With', 'XMLHttpRequest'] })
                .post('/url', body)
                .matchHeader('x-foo', 'foo')
                .reply(mockResponse.statusCode, mockBody);

            http.post(
                '/url',
                { 'X-Foo': 'foo' },
                body,
                { cors: true },
                (err, response) => {
                    expect(XMLHttpRequest.callCount).to.equal(1);
                    expect(err).to.equal(null);
                    const options = response.rawRequest;
                    expect(options.withCredentials).to.equal(false);
                    expect(response.statusCode).to.equal(200);
                    expect(response.responseText).to.equal('BODY');
                    done();
                }
            );
        });
    });

    describe('#400 requests', () => {
        beforeEach(() => {
            mockResponse = {
                statusCode: 400,
            };
        });

        it('GET with no response', (done) => {
            mockBody = undefined;
            nock(url).get('/url').reply(mockResponse.statusCode, mockBody);

            http.get('/url', { 'X-Foo': 'foo' }, {}, (err) => {
                expect(err.message).to.equal('Error 400');
                expect(err.statusCode).to.equal(400);
                expect(err.body).to.equal('');
                done();
            });
        });

        it('GET with empty response', (done) => {
            mockBody = '';
            nock(url).get('/url').reply(mockResponse.statusCode, mockBody);

            http.get('/url', { 'X-Foo': 'foo' }, {}, (err) => {
                expect(err.message).to.equal('Error 400');
                expect(err.statusCode).to.equal(400);
                expect(err.body).to.equal('');
                done();
            });
        });

        it('GET with JSON response containing message attribute', (done) => {
            mockBody = '{"message":"some body content"}';
            nock(url).get('/url').reply(mockResponse.statusCode, mockBody);

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
            nock(url).get('/url').reply(mockResponse.statusCode, mockBody);

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
            nock(url).get('/url').reply(mockResponse.statusCode, mockBody);

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
            mockBody = 'BODY';
            mockResponse = {
                statusCode: 408,
            };
        });

        it('GET with no retry', (done) => {
            nock(url).get('/url').reply(mockResponse.statusCode, mockBody);

            http.get('/url', { 'X-Foo': 'foo' }, {}, (err) => {
                expect(XMLHttpRequest.callCount).to.equal(1);
                expect(err.message).to.equal('BODY');
                expect(err.statusCode).to.equal(408);
                expect(err.body).to.equal('BODY');
                done();
            });
        });

        it('GET with retry', (done) => {
            nock(url)
                .get('/url')
                .reply(mockResponse.statusCode, mockBody)
                .get('/url')
                .reply(mockResponse.statusCode, mockBody);

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
                    expect(XMLHttpRequest.callCount).to.equal(2);
                    expect(err.message).to.equal('BODY');
                    expect(err.statusCode).to.equal(408);
                    expect(err.body).to.equal('BODY');
                    done();
                }
            );
        });

        it('GET with retry and custom status code', function (done) {
            mockResponse = { statusCode: 502 };

            nock(url)
                .get('/url')
                .reply(mockResponse.statusCode, mockBody)
                .get('/url')
                .reply(mockResponse.statusCode, mockBody);

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
                    expect(XMLHttpRequest.callCount).to.equal(2);
                    done();
                }
            );
        });
    });

    describe('#Timeout', () => {
        let config;

        beforeEach(() => {
            mockResponse = { statusCode: 200 };
            mockBody = 'BODY';
        });

        describe('#No timeout set for individual call', () => {
            beforeEach(() => {
                config = { xhrTimeout: 3000 };
            });

            it('should use xhrTimeout for GET', (done) => {
                nock(url).get('/url').reply(mockResponse.statusCode, mockBody);

                http.get(
                    '/url',
                    { 'X-Foo': 'foo' },
                    config,
                    (err, response) => {
                        const options = response.rawRequest;
                        expect(options.timeout).to.equal(3000);
                        done();
                    }
                );
            });

            it('should use xhrTimeout for POST', (done) => {
                const body = { data: 'data' };
                nock(url)
                    .post('/url', body)
                    .reply(mockResponse.statusCode, mockBody);

                http.post(
                    '/url',
                    { 'X-Foo': 'foo' },
                    body,
                    config,
                    (err, response) => {
                        const options = response.rawRequest;
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
                nock(url).get('/url').reply(mockResponse.statusCode, mockBody);

                http.get(
                    '/url',
                    { 'X-Foo': 'foo' },
                    config,
                    (err, response) => {
                        const options = response.rawRequest;
                        expect(options.timeout).to.equal(6000);
                        done();
                    }
                );
            });

            it('should override default xhrTimeout for POST', (done) => {
                const body = { data: 'data' };
                nock(url)
                    .post('/url', body)
                    .reply(mockResponse.statusCode, mockBody);

                http.post(
                    '/url',
                    { 'X-Foo': 'foo' },
                    body,
                    config,
                    (err, response) => {
                        const options = response.rawRequest;
                        expect(options.timeout).to.equal(6000);
                        done();
                    }
                );
            });
        });
    });

    describe('xhr errors', () => {
        it('should pass-through any xhr error', (done) => {
            mockResponse = { statusCode: 0 };
            nock(url).get('/url').reply(500);

            http.get('/url', {}, { xhrTimeout: 42 }, (err) => {
                expect(err.timeout).to.equal(42);
                expect(err.url).to.equal('/url');
                done();
            });
        });
    });
});
