/**
 * Copyright 2015, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

'use strict';

const fetchMock = require('fetch-mock');
const { expect } = require('chai');
const sinon = require('sinon');
const httpRequest = require('../../../../libs/util/http.client').default;

describe('Client HTTP', function () {
    const data = { data: 'data' };
    const url = '/url';
    const headers = { 'X-Foo': 'foo' };

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
        const config = {};

        beforeEach(function () {
            responseStatus = 200;
            mockBody = { data: 'BODY' };
        });

        it('GET', function () {
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            const method = 'GET';

            return httpRequest({ config, headers, method, url }).then(
                (response) => {
                    expect(fetchMock.calls()).to.have.lengthOf(1);
                    const options = fetchMock.lastCall().request;
                    expect(options.url).to.equal('/url');
                    expect(options.headers.get('X-Requested-With')).to.equal(
                        'XMLHttpRequest'
                    );
                    expect(options.headers.get('X-Foo')).to.equal('foo');
                    expect(options.method).to.equal('GET');
                    expect(response).to.deep.equal(mockBody);
                }
            );
        });

        it('POST', function () {
            fetchMock.post('/url', {
                body: mockBody,
                status: responseStatus,
            });

            const method = 'POST';

            return httpRequest({ config, data, headers, method, url }).then(
                () => {
                    expect(fetchMock.calls()).to.have.lengthOf(1);
                    const options = fetchMock.lastCall().request;
                    expect(options.url).to.equal('/url');
                    expect(options.headers.get('X-Requested-With')).to.equal(
                        'XMLHttpRequest'
                    );
                    expect(options.headers.get('X-Foo')).to.equal('foo');
                    expect(options.method).to.equal('POST');
                    expect(options.body.toString()).to.eql('{"data":"data"}');
                }
            );
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

            const config = { cors: true, withCredentials: true };
            const method = 'GET';

            return httpRequest({ config, headers, method, url }).then(
                (response) => {
                    expect(fetchMock.calls()).to.have.lengthOf(1);
                    const options = fetchMock.lastCall().request;
                    expect(options.url).to.equal('/url');
                    expect(options.headers).to.not.have.property(
                        'X-Requested-With'
                    );
                    expect(options.headers.get('X-Foo')).to.equal('foo');
                    expect(options.method).to.equal('GET');
                    expect(response).to.deep.equal(mockBody);

                    sinon.assert.calledWith(
                        Request,
                        sinon.match.string,
                        sinon.match({ credentials: 'include' })
                    );
                }
            );
        });

        it('POST', function () {
            fetchMock.post('/url', {
                body: mockBody,
                status: responseStatus,
            });

            const config = { cors: true };
            const method = 'POST';

            return httpRequest({ config, data, headers, method, url }).then(
                () => {
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
                }
            );
        });
    });

    describe('#400 requests', function () {
        const requestOptions = {
            config: {},
            headers: { 'X-Foo': 'foo' },
            method: 'GET',
            url: '/url',
        };

        beforeEach(function () {
            responseStatus = 400;
        });

        it('GET with empty response', function () {
            mockBody = '';
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            return httpRequest(requestOptions).catch((err) => {
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

            return httpRequest(requestOptions).catch((err) => {
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

            return httpRequest(requestOptions).catch((err) => {
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

            return httpRequest(requestOptions).catch((err) => {
                expect(err.message).to.equal(mockBody);
                expect(err.statusCode).to.equal(400);
                expect(err.body).to.equal(mockBody);
            });
        });
    });

    describe('#Retry', function () {
        const method = 'GET';

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

        it('GET with no retry', function () {
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            const config = {};

            return httpRequest({ config, method, headers, url }).catch(
                (err) => {
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
                }
            );
        });

        it('GET with retry', function () {
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            const config = {
                retry: {
                    interval: 200,
                    maxRetries: 1,
                },
            };

            return httpRequest({ config, headers, method, url }).catch(
                (err) => {
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
                }
            );
        });

        it('GET with retry and custom status code', function () {
            responseStatus = 502;
            fetchMock.get('/url', {
                body: mockBody,
                status: responseStatus,
            });

            const config = {
                retry: {
                    interval: 20,
                    maxRetries: 1,
                    statusCodes: [502],
                },
            };

            return httpRequest({ config, headers, method, url }).catch(() => {
                expect(fetchMock.calls()).to.have.lengthOf(2);

                const [req1, req2] = fetchMock.calls();
                expectRequestsToBeEqual(req1, req2);
            });
        });
    });

    describe('#Timeout', function () {
        let config;

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

            it('should use xhrTimeout for GET', function () {
                fetchMock.get('/url', {
                    body: mockBody,
                    status: responseStatus,
                });

                const method = 'GET';

                return httpRequest({ config, headers, method, url }).then(
                    () => {
                        sinon.assert.calledWith(
                            setTimeout,
                            sinon.match.func,
                            3000
                        );
                    }
                );
            });

            it('should use xhrTimeout for POST', function () {
                fetchMock.post('/url', {
                    body: mockBody,
                    status: responseStatus,
                });

                const method = 'POST';

                return httpRequest({ config, data, headers, method, url }).then(
                    () => {
                        sinon.assert.calledWith(
                            setTimeout,
                            sinon.match.func,
                            3000
                        );
                    }
                );
            });
        });

        describe('#Timeout set for individual call', function () {
            beforeEach(function () {
                config = { xhrTimeout: 3000, timeout: 6000 };
            });

            it('should override default xhrTimeout for GET', function () {
                fetchMock.get('/url', {
                    body: mockBody,
                    status: responseStatus,
                });

                const method = 'GET';

                return httpRequest({ config, headers, method, url }).then(
                    () => {
                        sinon.assert.calledWith(
                            setTimeout,
                            sinon.match.func,
                            6000
                        );
                    }
                );
            });

            it('should override default xhrTimeout for POST', function () {
                fetchMock.post('/url', {
                    body: mockBody,
                    status: responseStatus,
                });

                const method = 'POST';

                return httpRequest({ config, data, headers, method, url }).then(
                    () => {
                        sinon.assert.calledWith(
                            setTimeout,
                            sinon.match.func,
                            6000
                        );
                    }
                );
            });
        });
    });

    describe('request errors', function () {
        it('should pass-through any error', function () {
            responseStatus = 0;
            fetchMock.get('/url', {
                throws: new Error('AnyError'),
                status: responseStatus,
            });

            const config = { xhrTimeout: 42 };

            return httpRequest({ url, headers, config }).catch((err) => {
                expect(err.message).to.equal('AnyError');
                expect(err.timeout).to.equal(42);
                expect(err.url).to.equal('/url');
            });
        });
    });
});
