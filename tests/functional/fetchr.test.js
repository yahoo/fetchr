/* global Fetchr */
const { expect } = require('chai');
const puppeteer = require('puppeteer');
const FetchrError = require('../../libs/util/FetchrError');
const app = require('./app');
const buildClient = require('./buildClient');
const { itemsData } = require('./resources/item');
const { retryToggle } = require('./resources/error');

describe('client/server integration', () => {
    let browser;
    let server;
    let page;

    before(async function setupClient() {
        await buildClient();
    });

    before(function setupServer(done) {
        server = app.listen(3000, done);
    });

    before(async function setupBrowser() {
        browser = await puppeteer.launch({ headless: 'new' });
        page = await browser.newPage();
        await page.goto('http://localhost:3000');
    });

    after(async function shutdownBrowser() {
        await browser.close();
    });

    after(function shutdownServer(done) {
        server.close(done);
    });

    beforeEach(() => {
        retryToggle.error = true;
    });

    describe('CRUD', () => {
        it('can create item', async () => {
            const response = await page.evaluate(() => {
                const fetcher = new Fetchr({});
                return fetcher.create(
                    'item',
                    { id: '42' },
                    { value: 'this is an item' },
                );
            });

            expect(itemsData).to.deep.equal({
                42: {
                    id: '42',
                    value: 'this is an item',
                },
            });
            expect(response.data).to.deep.equal({
                id: '42',
                value: 'this is an item',
            });
            expect(response.meta).to.deep.equal({ statusCode: 201 });
        });

        it('can read one item', async () => {
            const response = await page.evaluate(() => {
                const fetcher = new Fetchr({});
                return fetcher.read('item', { id: '42' });
            });

            expect(response.data).to.deep.equal({
                id: '42',
                value: 'this is an item',
            });
            expect(response.meta).to.deep.equal({
                statusCode: 200,
            });
        });

        it('can read many items', async () => {
            const response = await page.evaluate(() => {
                const fetcher = new Fetchr({});
                return fetcher.read('item', null);
            });

            expect(response.data).to.deep.equal([
                {
                    id: '42',
                    value: 'this is an item',
                },
            ]);
            expect(response.meta).to.deep.equal({
                statusCode: 200,
            });
        });

        it('can update item', async () => {
            const response = await page.evaluate(() => {
                const fetcher = new Fetchr({});
                return fetcher.update(
                    'item',
                    { id: '42' },
                    { value: 'this is an updated item' },
                );
            });

            expect(itemsData).to.deep.equal({
                42: {
                    id: '42',
                    value: 'this is an updated item',
                },
            });
            expect(response.data).to.deep.equal({
                id: '42',
                value: 'this is an updated item',
            });
            expect(response.meta).to.deep.equal({ statusCode: 201 });
        });

        it('can delete item', async () => {
            const response = await page.evaluate(() => {
                const fetcher = new Fetchr({});
                return fetcher.delete('item', { id: '42' });
            });

            expect(itemsData).to.deep.equal({});
            expect(response.data).to.deep.equal(null);
            expect(response.meta).to.deep.equal({ statusCode: 200 });
        });
    });

    describe('Error handling', () => {
        describe('GET', () => {
            it('can handle unconfigured server', async () => {
                const response = await page.evaluate(() => {
                    const fetcher = new Fetchr({
                        xhrPath: 'http://localhost:3001',
                    });
                    return fetcher.read('error', null).catch((err) => err);
                });

                expect(response).to.deep.equal({
                    body: null,
                    message: 'Failed to fetch',
                    meta: null,
                    name: 'FetchrError',
                    output: null,
                    rawRequest: {
                        url: 'http://localhost:3001/error',
                        method: 'GET',
                        headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    },
                    reason: FetchrError.UNKNOWN,
                    statusCode: 0,
                    timeout: 3000,
                    url: 'http://localhost:3001/error',
                });
            });

            it('can handle service expected errors', async () => {
                const response = await page.evaluate(() => {
                    const fetcher = new Fetchr({});
                    return fetcher.read('error', null).catch((err) => err);
                });

                expect(response).to.deep.equal({
                    body: {
                        output: { message: 'error' },
                        meta: { foo: 'bar' },
                    },
                    message:
                        '{"output":{"message":"error"},"meta":{"foo":"bar"}}',
                    meta: { foo: 'bar' },
                    name: 'FetchrError',
                    output: { message: 'error' },
                    rawRequest: {
                        url: 'http://localhost:3000/api/error',
                        method: 'GET',
                        headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    },
                    reason: FetchrError.BAD_HTTP_STATUS,
                    statusCode: 400,
                    timeout: 3000,
                    url: 'http://localhost:3000/api/error',
                });
            });

            it('can handle service unexpected errors', async () => {
                const response = await page.evaluate(() => {
                    const fetcher = new Fetchr({});
                    return fetcher
                        .read('error', { error: 'unexpected' })
                        .catch((err) => err);
                });

                expect(response).to.deep.equal({
                    body: {
                        output: { message: 'unexpected' },
                        meta: {},
                    },
                    message: '{"output":{"message":"unexpected"},"meta":{}}',
                    meta: {},
                    name: 'FetchrError',
                    output: { message: 'unexpected' },
                    rawRequest: {
                        url: 'http://localhost:3000/api/error;error=unexpected',
                        method: 'GET',
                        headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    },
                    reason: FetchrError.BAD_HTTP_STATUS,
                    statusCode: 500,
                    timeout: 3000,
                    url: 'http://localhost:3000/api/error;error=unexpected',
                });
            });

            it('can handle incorrect api path', async () => {
                const response = await page.evaluate(() => {
                    const fetcher = new Fetchr({ xhrPath: '/non-existent' });
                    return fetcher.read('item', null).catch((err) => err);
                });

                expect(response).to.deep.equal({
                    body: { error: 'page not found' },
                    message: '{"error":"page not found"}',
                    meta: null,
                    name: 'FetchrError',
                    output: null,
                    rawRequest: {
                        url: 'http://localhost:3000/non-existent/item',
                        method: 'GET',
                        headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    },
                    reason: FetchrError.BAD_HTTP_STATUS,
                    statusCode: 404,
                    timeout: 3000,
                    url: 'http://localhost:3000/non-existent/item',
                });
            });

            it('can handle aborts', async () => {
                const response = await page.evaluate(() => {
                    const fetcher = new Fetchr({});
                    const request = fetcher.read('slow', null);

                    request.abort();

                    return request.catch((err) => err);
                });

                expect(response).to.deep.equal({
                    body: null,
                    message: 'signal is aborted without reason',
                    meta: null,
                    name: 'FetchrError',
                    output: null,
                    rawRequest: {
                        url: 'http://localhost:3000/api/slow',
                        method: 'GET',
                        headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    },
                    reason: FetchrError.ABORT,
                    statusCode: 0,
                    timeout: 3000,
                    url: 'http://localhost:3000/api/slow',
                });
            });

            it('can abort after a timeout', async () => {
                // This test triggers a call to the slow resource
                // (which always takes 5s to respond) with a timeout
                // of 200ms. After that, we schedule an abort call
                // after 500ms (in the middle of the 3rd call).

                // Since the abort and the timeout mechanisms share
                // the same AbortController instance, this test
                // assures that after internal abortions (due to the
                // timeouts) it's still possible to make the user
                // abort mechanism work.

                const response = await page.evaluate(() => {
                    const fetcher = new Fetchr({});
                    const promise = fetcher.read('slow', null, {
                        retry: { maxRetries: 5, interval: 0 },
                        timeout: 200,
                    });

                    return new Promise((resolve) =>
                        setTimeout(() => {
                            promise.abort();
                            resolve();
                        }, 500),
                    ).then(() => promise.catch((err) => err));
                });

                expect(response.reason).to.equal(FetchrError.ABORT);
            });

            it('can handle timeouts', async () => {
                const response = await page.evaluate(() => {
                    const fetcher = new Fetchr({});
                    return fetcher
                        .read('error', { error: 'timeout' }, { timeout: 20 })
                        .catch((err) => err);
                });

                expect(response).to.deep.equal({
                    body: null,
                    message: 'Request failed due to timeout',
                    meta: null,
                    name: 'FetchrError',
                    output: null,
                    rawRequest: {
                        url: 'http://localhost:3000/api/error;error=timeout',
                        method: 'GET',
                        headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    },
                    reason: FetchrError.TIMEOUT,
                    statusCode: 0,
                    timeout: 20,
                    url: 'http://localhost:3000/api/error;error=timeout',
                });
            });

            it('can retry failed requests', async () => {
                const response = await page.evaluate(() => {
                    const fetcher = new Fetchr({});
                    return fetcher
                        .read(
                            'error',
                            { error: 'retry' },
                            { retry: { maxRetries: 2 } },
                        )
                        .catch((err) => err);
                });

                expect(response).to.deep.equal({
                    data: { retry: 'ok' },
                    meta: {},
                });
            });

            it('can retry timed out requests', async () => {
                // This test makes sure that we are renewing the
                // AbortController for each new request
                // attempt. Otherwise, after the first AbortController
                // is triggered, all the following requests would fail
                // instantly.

                const response = await page.evaluate(() => {
                    const fetcher = new Fetchr({});
                    return fetcher
                        .read('slow-then-fast', { reset: true })
                        .then(() =>
                            fetcher.read('slow-then-fast', null, {
                                retry: { maxRetries: 5 },
                                timeout: 80,
                            }),
                        );
                });

                expect(response.data.attempts).to.equal(3);
            });
        });

        describe('POST', () => {
            it('can handle unconfigured server', async () => {
                const response = await page.evaluate(() => {
                    const fetcher = new Fetchr({
                        xhrPath: 'http://localhost:3001',
                    });
                    return fetcher.create('error', null).catch((err) => err);
                });

                expect(response).to.deep.equal({
                    body: null,
                    message: 'Failed to fetch',
                    meta: null,
                    name: 'FetchrError',
                    output: null,
                    rawRequest: {
                        url: 'http://localhost:3001/error',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                    reason: FetchrError.UNKNOWN,
                    statusCode: 0,
                    timeout: 3000,
                    url: 'http://localhost:3001/error',
                });
            });

            it('can handle service expected errors', async () => {
                const response = await page.evaluate(() => {
                    const fetcher = new Fetchr({});
                    return fetcher.create('error', null).catch((err) => err);
                });

                expect(response).to.deep.equal({
                    body: {
                        output: { message: 'error' },
                        meta: { foo: 'bar' },
                    },
                    message:
                        '{"output":{"message":"error"},"meta":{"foo":"bar"}}',
                    meta: { foo: 'bar' },
                    name: 'FetchrError',
                    output: { message: 'error' },
                    rawRequest: {
                        url: 'http://localhost:3000/api/error',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                    reason: FetchrError.BAD_HTTP_STATUS,
                    statusCode: 400,
                    timeout: 3000,
                    url: 'http://localhost:3000/api/error',
                });
            });

            it('can handle service unexpected errors', async () => {
                const response = await page.evaluate(() => {
                    const fetcher = new Fetchr({});
                    return fetcher
                        .create('error', { error: 'unexpected' })
                        .catch((err) => err);
                });

                expect(response).to.deep.equal({
                    body: {
                        output: { message: 'unexpected' },
                        meta: {},
                    },
                    message: '{"output":{"message":"unexpected"},"meta":{}}',
                    meta: {},
                    name: 'FetchrError',
                    output: { message: 'unexpected' },
                    rawRequest: {
                        url: 'http://localhost:3000/api/error',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                    reason: FetchrError.BAD_HTTP_STATUS,
                    statusCode: 500,
                    timeout: 3000,
                    url: 'http://localhost:3000/api/error',
                });
            });

            it('can handle incorrect api path', async () => {
                const response = await page.evaluate(() => {
                    const fetcher = new Fetchr({ xhrPath: '/non-existent' });
                    return fetcher.create('item', null).catch((err) => err);
                });

                expect(response).to.deep.equal({
                    body: { error: 'page not found' },
                    message: '{"error":"page not found"}',
                    meta: null,
                    name: 'FetchrError',
                    output: null,
                    rawRequest: {
                        url: 'http://localhost:3000/non-existent/item',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                    reason: FetchrError.BAD_HTTP_STATUS,
                    statusCode: 404,
                    timeout: 3000,
                    url: 'http://localhost:3000/non-existent/item',
                });
            });

            it('can handle timeouts', async () => {
                const response = await page.evaluate(() => {
                    const fetcher = new Fetchr({});
                    return fetcher
                        .create('error', { error: 'timeout' }, null, {
                            timeout: 20,
                        })
                        .catch((err) => err);
                });

                expect(response).to.deep.equal({
                    body: null,
                    message: 'Request failed due to timeout',
                    meta: null,
                    name: 'FetchrError',
                    output: null,
                    rawRequest: {
                        url: 'http://localhost:3000/api/error',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                    reason: FetchrError.TIMEOUT,
                    statusCode: 0,
                    timeout: 20,
                    url: 'http://localhost:3000/api/error',
                });
            });

            it('can retry failed requests', async () => {
                const response = await page.evaluate(() => {
                    const fetcher = new Fetchr({});
                    return fetcher
                        .create('error', { error: 'retry' }, null, {
                            retry: { maxRetries: 2 },
                            unsafeAllowRetry: true,
                        })
                        .catch((err) => err);
                });

                expect(response).to.deep.equal({
                    data: { retry: 'ok' },
                    meta: {},
                });
            });
        });
    });

    describe('headers', () => {
        it('can handle request and response headers', async () => {
            const response = await page.evaluate(() => {
                const fetcher = new Fetchr({});
                return fetcher
                    .read('header', null, {
                        headers: { 'x-fetchr-request': '42' },
                    })
                    .catch((err) => err);
            });

            expect(response).to.deep.equal({
                data: { headers: 'ok' },
                meta: {
                    headers: { 'x-fetchr-response': '42' },
                },
            });
        });
    });
});
