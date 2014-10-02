/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
/*jshint expr:true*/
/*globals before,describe,it */
"use strict";

var chai = require('chai');
chai.config.includeStack = true;
var expect = chai.expect,
    Fetcher = require('../../../libs/fetcher'),
    fetcher = new Fetcher({
        req: {}
    }),
    mockFetcher = require('../../mock/fakeFetcher'),
    mockErrorFetcher = require('../../mock/fakeErrorFetcher'),
    _ = require('lodash'),
    qs = require('querystring');

describe('Server Fetcher', function () {

    it('should register fetchers', function () {
        var fn = Fetcher.getFetcher.bind(fetcher, mockFetcher.name);
        expect(_.size(Fetcher.fetchers)).to.equal(0);
        expect(fn).to.throw(Error, 'Fetcher could not be found');
        Fetcher.registerFetcher(mockFetcher);
        expect(_.size(Fetcher.fetchers)).to.equal(1);
        expect(fn()).to.deep.equal(mockFetcher);
        Fetcher.registerFetcher(mockErrorFetcher);
        expect(_.size(Fetcher.fetchers)).to.equal(2);
    });

    describe('#middleware', function () {
        describe('#POST', function() {
            it('should 404 to POST request with no req.body.requests object', function (done) {
                var operation = 'create',
                    req = {
                        method: 'POST',
                        path: '/resource/' + mockFetcher.name,
                        body: {
                            requests: {},
                            context: {
                                site: '',
                                devide: ''
                            }
                        }
                    },
                    res = {
                        status: function (code) {
                            expect(code).to.equal(400);
                            return this;
                        },
                        end: function () {
                            done();
                        }
                    },
                    next = function () {
                        console.log('Not Expected: middleware skipped request');
                    },
                    middleware = Fetcher.middleware();

                middleware(req, res, next);
            });

            it('should respond to POST api request', function (done) {
                var operation = 'create',
                    statusCodeSet = false,
                    req = {
                        method: 'POST',
                        path: '/resource/' + mockFetcher.name,
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
                            expect(data).to.contain.keys('operation', 'args');
                            expect(data.operation).to.equal('create');
                            expect(data.args).to.contain.keys('params');
                            expect(data.args.params).to.equal(req.body.requests.g0.params);
                            done();
                        },
                        status: function(code) {
                            expect(code).to.equal(200);
                            statusCodeSet = true;
                            return this;
                        },
                        send: function (code) {
                            console.log('Not Expected: middleware responded with', code);
                        }
                    },
                    next = function () {
                        console.log('Not Expected: middleware skipped request');
                    },
                    middleware = Fetcher.middleware();

                middleware(req, res, next);
                expect(statusCodeSet).to.be.true;
            });

            it('should respond to POST api request with custom status code', function (done) {
                var operation = 'create',
                    statusCodeSet = false,
                    req = {
                        method: 'POST',
                        path: '/resource/' + mockFetcher.name,
                        body: {
                            requests: {
                                g0: {
                                    resource: mockFetcher.name,
                                    operation: operation,
                                    params: {
                                        uuids: ['cd7240d6-aeed-3fed-b63c-d7e99e21ca17', 'cd7240d6-aeed-3fed-b63c-d7e99e21ca17'],
                                        id: 'asdf',
                                        'meta.statusCode': '201'
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
                            expect(data).to.contain.keys('operation', 'args');
                            expect(data.operation).to.equal('create');
                            expect(data.args).to.contain.keys('params');
                            expect(data.args.params).to.equal(req.body.requests.g0.params);
                            done();
                        },
                        status: function(code) {
                            // It's only a string because the qs.stringify call above turns into one normally this would be an integer
                            expect(code).to.equal('201');
                            statusCodeSet = true;
                            return this;
                        },
                        send: function (code) {
                            console.log('Not Expected: middleware responded with', code);
                        }
                    },
                    next = function () {
                        console.log('Not Expected: middleware skipped request');
                    },
                    middleware = Fetcher.middleware({pathPrefix: '/api'});
                middleware(req, res, next);
                expect(statusCodeSet).to.be.true;
            });

            var makePostApiErrorTest = function(params, expStatusCode, expMessage) {
                return function(done) {
                    var operation = 'create',
                        statusCodeSet = false,
                        req = {
                            method: 'POST',
                            path: '/resource/' + mockErrorFetcher.name,
                            body: {
                                requests: {
                                    g0: {
                                        resource: mockErrorFetcher.name,
                                        operation: operation,
                                        params: params
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
                                console.log('Not Expected: middleware responded with', response);
                            },
                            status: function(code) {
                                expect(code).to.equal(expStatusCode);
                                statusCodeSet = true;
                                return this;
                            },
                            send: function (data) {
                                expect(data).to.equal(expMessage);
                                done();
                            }
                        },
                        next = function () {
                            console.log('Not Expected: middleware skipped request');
                        },
                        middleware = Fetcher.middleware({pathPrefix: '/api'});
                    middleware(req, res, next);
                    expect(statusCodeSet).to.be.true;
                };
            };

            it('should respond to POST api request with default error details',
               makePostApiErrorTest({}, 400, 'request failed'));

            it('should respond to POST api request with custom error status code',
               makePostApiErrorTest({statusCode: 500}, 500, 'request failed'));

            it('should respond to POST api request with custom error message',
               makePostApiErrorTest({message: 'Error message...'}, 400, 'Error message...'));
        });

        describe('#GET', function() {
            it('should respond to GET api request', function (done) {
                var operation = 'read',
                    statusCodeSet = false,
                    params = {
                        uuids: ['cd7240d6-aeed-3fed-b63c-d7e99e21ca17', 'cd7240d6-aeed-3fed-b63c-d7e99e21ca17'],
                        id: 'asdf',
                    },
                    req = {
                        method: 'GET',
                        path: '/resource/' + mockFetcher.name + ';' + qs.stringify(params, ';')
                    },
                    res = {
                        json: function(response) {
                            expect(response).to.exist;
                            expect(response).to.not.be.empty;
                            expect(response).to.contain.keys('operation', 'args');
                            expect(response.operation).to.equal('read');
                            expect(response.args).to.contain.keys('params');
                            expect(response.args.params).to.deep.equal(params);
                            done();
                        },
                        status: function(code) {
                            expect(code).to.equal(200);
                            statusCodeSet = true;
                            return this;
                        },
                        send: function (code) {
                            console.log('Not Expected: middleware responded with', code);
                        }
                    },
                    next = function () {
                        console.log('Not Expected: middleware skipped request');
                    },
                    middleware = Fetcher.middleware({pathPrefix: '/api'});
                middleware(req, res, next);
                expect(statusCodeSet).to.be.true;
            });

            it('should respond to GET api request with custom status code', function (done) {
                var operation = 'read',
                    statusCodeSet = false,
                    params = {
                        uuids: ['cd7240d6-aeed-3fed-b63c-d7e99e21ca17', 'cd7240d6-aeed-3fed-b63c-d7e99e21ca17'],
                        id: 'asdf',
                        'meta.statusCode': '201'
                    },
                    req = {
                        method: 'GET',
                        path: '/resource/' + mockFetcher.name + ';' + qs.stringify(params, ';')
                    },
                    res = {
                        json: function(response) {
                            expect(response).to.exist;
                            expect(response).to.not.be.empty;
                            expect(response).to.contain.keys('operation', 'args');
                            expect(response.operation).to.equal('read');
                            expect(response.args).to.contain.keys('params');
                            expect(response.args.params).to.deep.equal(params);
                            done();
                        },
                        status: function(code) {
                            // It's only a string because the qs.stringify call above turns into one normally this would be an integer
                            expect(code).to.equal('201');
                            statusCodeSet = true;
                            return this;
                        },
                        send: function (code) {
                            console.log('Not Expected: middleware responded with', code);
                        }
                    },
                    next = function () {
                        console.log('Not Expected: middleware skipped request');
                    },
                    middleware = Fetcher.middleware({pathPrefix: '/api'});
                middleware(req, res, next);
                expect(statusCodeSet).to.be.true;
            });

            var makeGetApiErrorTest = function(params, expStatusCode, expMessage) {
                return function(done) {
                    var operation = 'read',
                        statusCodeSet = false,
                        req = {
                            method: 'GET',
                            path: '/resource/' + mockErrorFetcher.name + ';' + qs.stringify(params, ';')
                        },
                        res = {
                            json: function(response) {
                                console.log('Not Expected: middleware responded with', response);
                            },
                            status: function(code) {
                                expect(code).to.equal(expStatusCode);
                                statusCodeSet = true;
                                return this;
                            },
                            send: function (data) {
                                expect(data).to.equal(expMessage);
                                done();
                            }
                        },
                        next = function () {
                            console.log('Not Expected: middleware skipped request');
                        },
                        middleware = Fetcher.middleware({pathPrefix: '/api'});
                    middleware(req, res, next);
                    expect(statusCodeSet).to.be.true;
                };
            };

            it('should respond to GET api request with default error details',
               makeGetApiErrorTest({}, 400, 'request failed'));

            it('should respond to GET api request with custom error status code',
               makeGetApiErrorTest({statusCode: 500}, 500, 'request failed'));

            it('should respond to GET api request with custom error message',
               makeGetApiErrorTest({message: 'Error message...'}, 400, 'Error message...'));
        });
    });

    describe('#CRUD', function () {
        var resource = mockFetcher.name,
            params = {},
            body = {},
            config = {},
            callback = function(operation, done) {
                return function(err, data) {
                    if (err){
                        done(err);
                    }
                    expect(data.operation).to.equal(operation);
                    done();
                };
            };

        it('should handle CREATE', function (done) {
            var operation = 'create';
            fetcher[operation](resource, params, body, config, callback(operation, done));
        });
        it('should handle CREATE w/ no config', function (done) {
            var operation = 'create';
            fetcher[operation](resource, params, body, callback(operation, done));
        });
        it('should handle READ', function (done) {
            var operation = 'read';
            fetcher[operation](resource, params, config, callback(operation, done));
        });
        it('should handle READ w/ no config', function (done) {
            var operation = 'read';
            fetcher[operation](resource, params, callback(operation, done));
        });
        it('should handle UPDATE', function (done) {
            var operation = 'update';
            fetcher[operation](resource, params, body, config, callback(operation, done));
        });
        it('should handle UPDATE w/ no config', function (done) {
            var operation = 'update';
            fetcher[operation](resource, params, body, callback(operation, done));
        });
        it('should handle DELETE', function (done) {
            var operation = 'del';
            fetcher[operation](resource, params, config, callback(operation, done));
        });
        it('should handle DELETE w/ no config', function (done) {
            var operation = 'del';
            fetcher[operation](resource, params, callback(operation, done));
        });
    });

});
