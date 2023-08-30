// As seen in isomorphic-fetch fetch polyfill:
// https://github.com/matthew-andrews/isomorphic-fetch/blob/fc5e0d0d0b180e5b4c70b2ae7f738c50a9a51b25/fetch-npm-node.js

'use strict';

const nodeFetch = require('node-fetch');
const {
    AbortController,
    abortableFetch,
} = require('abortcontroller-polyfill/dist/cjs-ponyfill');

const { fetch, Request } = abortableFetch({
    fetch: nodeFetch,
    Request: nodeFetch.Request,
});

global.AbortController = AbortController;
global.Headers = nodeFetch.Headers;
global.Request = Request;
global.Response = nodeFetch.Response;
global.fetch = fetch;
