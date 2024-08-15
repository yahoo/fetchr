/**
 * Copyright 2015, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

'use strict';

const fetchMock = require('fetch-mock');
const { expect } = require('chai');
const sinon = require('sinon');
const FetchrError = require('../../../../libs/util/FetchrError');
const httpRequest = require('../../../../libs/util/httpRequest');

const contentTypeHeader = { ['Content-Type']: 'application/json' };
const customHeader = { 'X-Foo': 'foo' };
const requestedWithHeader = { ['X-Requested-With']: 'XMLHttpRequest' };

const defaultRetry = {
    interval: 200,
    maxRetries: 0,
    retryOnPost: false,
    statusCodes: [0, 408, 999],
};

const baseConfig = {
    credentials: 'same-origin',
    body: undefined,
    headers: {
        ...customHeader,
        ...requestedWithHeader,
    },
    method: 'GET',
    retry: defaultRetry,
    timeout: 3000,
    url: '/url',
};

const GETConfig = {
    ...baseConfig,
    method: 'GET',
};

const corsGETConfig = {
    ...GETConfig,
    credentials: 'include',
    headers: customHeader,
};

const POSTConfig = {
    ...baseConfig,
    body: JSON.stringify({ data: 'data' }),
    method: 'POST',
    headers: {
        ...contentTypeHeader,
        ...customHeader,
        ...requestedWithHeader,
    },
};

const corsPOSTConfig = {
    ...POSTConfig,
    headers: {
        ...contentTypeHeader,
        ...customHeader,
    },
};

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
            mockBody = { data: 'BODY' };
        });

        it('GET', function () {
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            return httpRequest(GETConfig).then((response) => {
                expect(fetchMock.calls()).to.have.lengthOf(1);
                const options = fetchMock.lastCall().request;
                expect(options.url).to.equal('/url');
                expect(options.headers.get('X-Requested-With')).to.equal(
                    'XMLHttpRequest',
                );
                expect(options.headers.get('X-Foo')).to.equal('foo');
                expect(options.method).to.equal('GET');
                expect(response).to.deep.equal(mockBody);
            });
        });

        it('POST', function () {
            fetchMock.post('/url', {
                body: mockBody,
                status: responseStatus,
            });

            return httpRequest(POSTConfig).then(() => {
                expect(fetchMock.calls()).to.have.lengthOf(1);
                const options = fetchMock.lastCall().request;
                expect(options.url).to.equal('/url');
                expect(options.headers.get('X-Requested-With')).to.equal(
                    'XMLHttpRequest',
                );
                expect(options.headers.get('X-Foo')).to.equal('foo');
                expect(options.method).to.equal('POST');
                expect(options.body.toString()).to.equal('{"data":"data"}');
            });
        });
    });

    describe('#Successful CORS requests', function () {
        beforeEach(function () {
            responseStatus = 200;
            mockBody = { data: 'BODY' };
            sinon.spy(global, 'Request');
        });

        afterEach(() => {
            Request.restore();
        });

        it('GET', function () {
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            return httpRequest(corsGETConfig).then((response) => {
                expect(fetchMock.calls()).to.have.lengthOf(1);
                const options = fetchMock.lastCall().request;
                expect(options.url).to.equal('/url');
                expect(options.headers).to.not.have.property(
                    'X-Requested-With',
                );
                expect(options.headers.get('X-Foo')).to.equal('foo');
                expect(options.method).to.equal('GET');
                expect(response).to.deep.equal(mockBody);

                sinon.assert.calledWith(
                    Request,
                    sinon.match.string,
                    sinon.match({ credentials: 'include' }),
                );
            });
        });

        it('POST', function () {
            fetchMock.post('/url', {
                body: mockBody,
                status: responseStatus,
            });

            return httpRequest(corsPOSTConfig).then(() => {
                expect(fetchMock.calls()).to.have.lengthOf(1);
                const options = fetchMock.lastCall().request;
                expect(options.url).to.equal('/url');
                expect(options.headers).to.not.have.property(
                    'X-Requested-With',
                );
                expect(options.headers.get('X-Foo')).to.equal('foo');
                expect(options.method).to.equal('POST');
                expect(options.body.toString()).to.eql('{"data":"data"}');

                sinon.assert.calledWith(
                    Request,
                    sinon.match.string,
                    sinon.match({ credentials: 'same-origin' }),
                );
            });
        });
    });

    describe('#400 requests', function () {
        beforeEach(function () {
            responseStatus = 400;
        });

        it('GET with empty response', function () {
            mockBody = '';
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            return httpRequest(GETConfig).catch((err) => {
                expect(err.message).to.equal('');
                expect(err.statusCode).to.equal(400);
                expect(err.body).to.equal('');
            });
        });

        it('GET with JSON response containing message attribute', function () {
            mockBody = '{"message":"some body content"}';
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            return httpRequest(GETConfig).catch((err) => {
                expect(err.message).to.equal('some body content');
                expect(err.statusCode).to.equal(400);
                expect(err.body).to.deep.equal({
                    message: 'some body content',
                });
            });
        });

        it('GET with JSON response not containing message attribute', function () {
            mockBody = '{"other":"some body content"}';
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            return httpRequest(GETConfig).catch((err) => {
                expect(err.message).to.equal(mockBody);
                expect(err.statusCode).to.equal(400);
                expect(err.body).to.deep.equal({
                    other: 'some body content',
                });
            });
        });

        // Need to test plain text response
        // as some servers (e.g. node running in IIS)
        // may remove body content
        // and replace it with 'Bad Request'
        // if not configured to allow content throughput
        it('GET with plain text', function () {
            mockBody = 'Bad Request';
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            return httpRequest(GETConfig).catch((err) => {
                expect(err.message).to.equal(mockBody);
                expect(err.statusCode).to.equal(400);
                expect(err.body).to.equal(mockBody);
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
                Object.fromEntries(req1.request.headers.entries()),
            ).to.deep.equal(Object.fromEntries(req2.request.headers.entries()));
            expect(req1.request.body).to.equal(req2.request.body);
        };

        it('GET with no retry', function () {
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            return httpRequest(GETConfig).catch((err) => {
                const options = fetchMock.lastCall().request;
                expect(fetchMock.calls()).to.have.lengthOf(1);
                expect(options.url).to.equal('/url');
                expect(options.headers.get('X-Requested-With')).to.equal(
                    'XMLHttpRequest',
                );
                expect(options.headers.get('X-Foo')).to.equal('foo');
                expect(options.method).to.equal('GET');
                expect(err.message).to.equal('BODY');
                expect(err.statusCode).to.equal(408);
                expect(err.body).to.equal('BODY');
            });
        });

        it('GET with retry', function () {
            fetchMock.get('/url', {
                body: mockBody,
                status: 429,
            });

            const config = {
                ...GETConfig,
                retry: {
                    ...defaultRetry,
                    interval: 10,
                    maxRetries: 2,
                    statusCodes: [429],
                },
            };

            return httpRequest(config).catch((err) => {
                expect(fetchMock.calls()).to.have.lengthOf(3);
                const options = fetchMock.lastCall().request;
                expect(options.url).to.equal('/url');
                expect(options.headers.get('X-Requested-With')).to.equal(
                    'XMLHttpRequest',
                );
                expect(options.headers.get('X-Foo')).to.equal('foo');
                expect(options.method).to.equal('GET');
                expect(err.message).to.equal('BODY');
                expect(err.statusCode).to.equal(429);
                expect(err.body).to.equal('BODY');

                const [req1, req2, req3] = fetchMock.calls();
                expectRequestsToBeEqual(req1, req2);
                expectRequestsToBeEqual(req1, req3);
            });
        });

        it('GET with retry and custom status code', function () {
            responseStatus = 502;
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            const config = {
                ...GETConfig,
                retry: {
                    ...defaultRetry,
                    interval: 20,
                    maxRetries: 1,
                    statusCodes: [502],
                },
            };

            return httpRequest(config).catch(() => {
                expect(fetchMock.calls()).to.have.lengthOf(2);

                const [req1, req2] = fetchMock.calls();
                expectRequestsToBeEqual(req1, req2);
            });
        });

        it('does not retry user aborted requests', function () {
            fetchMock.get('/url', {
                body: mockBody,
                status: 200,
            });

            const config = {
                ...GETConfig,
                retry: defaultRetry,
            };

            const request = httpRequest(config);

            request.abort();

            return request.catch((err) => {
                expect(fetchMock.calls()).to.have.lengthOf(1);
                expect(err.statusCode).to.equal(0);
                expect(err.reason).to.equal(FetchrError.ABORT);
            });
        });
    });

    describe('#Timeout', function () {
        beforeEach(function () {
            sinon.spy(global, 'setTimeout');
            responseStatus = 200;
            mockBody = {};
        });

        afterEach(() => {
            setTimeout.restore();
        });

        it('should use xhrTimeout for GET', function () {
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            return httpRequest(GETConfig).then(() => {
                sinon.assert.calledWith(setTimeout, sinon.match.func, 3000);
            });
        });

        it('should use xhrTimeout for POST', function () {
            fetchMock.post('/url', {
                body: mockBody,
                status: responseStatus,
            });

            return httpRequest(POSTConfig).then(() => {
                sinon.assert.calledWith(setTimeout, sinon.match.func, 3000);
            });
        });
    });

    describe('Other failure scenarios', function () {
        it('can handle errors from fetch itself', function () {
            responseStatus = 0;
            fetchMock.get('/url', {
                throws: new Error('AnyError'),
                status: responseStatus,
            });

            const config = {
                ...GETConfig,
                timeout: 42,
            };

            return httpRequest(config).catch((err) => {
                expect(err.message).to.equal('AnyError');
                expect(err.timeout).to.equal(42);
                expect(err.url).to.equal('/url');
            });
        });

        it('can handle OK responses with bad JSON', function () {
            fetchMock.get('/url', {
                status: 200,
                body: 'Hello World!',
            });

            return httpRequest(GETConfig).catch((err) => {
                expect(err.statusCode).to.equal(200);
                expect(err.message).to.equal(
                    'Cannot parse response into a JSON object',
                );
            });
        });
    });

    describe('Promise Support', () => {
        it('always returns the response if resolved multiple times', async function () {
            const body = { data: 'BODY' };

            fetchMock.get('/url', { body, status: responseStatus });

            const request = httpRequest(GETConfig);

            expect(await request).to.deep.equal(body);
            expect(await request).to.deep.equal(body);
        });

        it('works with Promise.all', function () {
            const body = { data: 'BODY' };

            fetchMock.get('/url', { body, status: responseStatus });

            const request = httpRequest(GETConfig);

            return Promise.all([request]).then(([result]) => {
                expect(result).to.deep.equal(body);
            });
        });
    });
});
