/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
/*jshint expr:true*/
/*globals before,describe,it */
"use strict";

var expect = require('chai').expect,
    Fetchr = require('../../../libs/fetcher'),
    mockFetcher = require('../../mock/fakeFetcher'),
    _ = require('lodash'),
    qs = require('querystring');

describe('Server Fetcher', function () {
    var fetcher;

    before(function() {
        fetcher = new Fetchr();
    });

    it('should register fetchers', function () {
        var fn = fetcher.getFetcher.bind(fetcher, mockFetcher.name);
        expect(_.size(fetcher.getAllFetchers())).to.equal(0);
        expect(fn).to.throw(Error, 'Fetcher could not be found');
        fetcher.addFetcher(mockFetcher);
        expect(_.size(fetcher.getAllFetchers())).to.equal(1);
        expect(fn()).to.deep.equal(mockFetcher);
    });

    describe('#middleware', function () {
        it('should skip non Fetchr requests', function (done) {
            var req = {
                    path: '/somerandomapi/'+mockFetcher.name
                },
                res = {
                    json: function () {
                        console.log('Not Expected: middleware responded with json');
                    },
                    send: function (code) {
                        console.log('Not Expected: middleware responded with', code);
                    }
                },
                next = function () {
                    done();
                },
                middleware = fetcher.middleware({pathPrefix: '/api'});

            middleware(req, res, next);
        });
        it('should respond to POST api request', function (done) {
            var operation = 'read',
                req = {
                    method: 'POST',
                    path: '/api/resource/' + mockFetcher.name,
                    body: {
                        requests: {
                            g0: {
                                resource: mockFetcher.name,
                                operation: operation,
                                params: {
                                    uuids: ['cd7240d6-aeed-3fed-b63c-d7e99e21ca17', 'cd7240d6-aeed-3fed-b63c-d7e99e21ca17'],
                                    id: 'asdf'
                                }
                            }
                        },
                        context: {
                            site: '',
                            devide: ''
                        }
                    }
                },
                res = {
                    json: function(response) {
                        expect(response).to.exist;
                        expect(response).to.not.be.empty;
                        var data = response.g0.data;
                        expect(data).to.contain.keys(operation, 'args');
                        expect(data[operation]).to.equal('success');
                        expect(data.args).to.contain.keys('params');
                        expect(data.args.params).to.equal(req.body.requests.g0.params);
                        done();
                    },
                    send: function (code) {
                        console.log('Not Expected: middleware responded with', code);
                    }
                },
                next = function () {
                    console.log('Not Expected: middleware skipped request');
                },
                middleware = fetcher.middleware({pathPrefix: '/api'});

            middleware(req, res, next);
        });
        it('should respond to GET api request', function (done) {
            var operation = 'read',
                params = {
                    uuids: ['cd7240d6-aeed-3fed-b63c-d7e99e21ca17', 'cd7240d6-aeed-3fed-b63c-d7e99e21ca17'],
                    id: 'asdf'
                },
                req = {
                    method: 'GET',
                    path: '/api/resource/' + mockFetcher.name + ';' + qs.stringify(params, ';')
                },
                res = {
                    json: function(response) {
                        expect(response).to.exist;
                        expect(response).to.not.be.empty;
                        expect(response).to.contain.keys(operation, 'args');
                        expect(response[operation]).to.equal('success');
                        expect(response.args).to.contain.keys('params');
                        expect(response.args.params).to.deep.equal(params);
                        done();
                    },
                    send: function (code) {
                        console.log('Not Expected: middleware responded with', code);
                    }
                },
                next = function () {
                    console.log('Not Expected: middleware skipped request');
                },
                middleware = fetcher.middleware({pathPrefix: '/api'});
            middleware(req, res, next);
        });
    });

    describe('#CRUD', function () {
        var resource = mockFetcher.name,
            params = {},
            body = {},
            context = {};
        it('should handle CREATE', function (done) {
            var operation = 'create';
            fetcher[operation](resource, params, body, context, done);
        });
        it('should handle READ', function (done) {
            var operation = 'read';
            fetcher[operation](resource, params, context, done);
        });
        it('should handle UPDATE', function (done) {
            var operation = 'update';
            fetcher[operation](resource, params, body, context, done);
        });
        it('should handle DELETE', function (done) {
            var operation = 'del';
            fetcher[operation](resource, params, context, done);
        });
    });

});
