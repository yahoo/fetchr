/* global Fetchr */
const { expect } = require('chai');
const puppeteer = require('puppeteer');
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
        browser = await puppeteer.launch();
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
                    { value: 'this is an item' }
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
                    { value: 'this is an updated item' }
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
                    reason: 'UNKNOWN',
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
                    reason: 'BAD_HTTP_STATUS',
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
                    reason: 'BAD_HTTP_STATUS',
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
                    reason: 'BAD_HTTP_STATUS',
                    statusCode: 404,
                    timeout: 3000,
                    url: 'http://localhost:3000/non-existent/item',
                });
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
                    message: 'The user aborted a request.',
                    meta: null,
                    name: 'FetchrError',
                    output: null,
                    rawRequest: {
                        url: 'http://localhost:3000/api/error;error=timeout',
                        method: 'GET',
                        headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    },
                    reason: 'UNKNOWN',
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
                            { retry: { maxRetries: 2 } }
                        )
                        .catch((err) => err);
                });

                expect(response).to.deep.equal({
                    data: { retry: 'ok' },
                    meta: {},
                });
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
                    reason: 'UNKNOWN',
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
                    reason: 'BAD_HTTP_STATUS',
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
                    reason: 'BAD_HTTP_STATUS',
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
                    reason: 'BAD_HTTP_STATUS',
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
                    message: 'The user aborted a request.',
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
                    reason: 'UNKNOWN',
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
