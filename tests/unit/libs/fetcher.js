/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
/*jshint expr:true*/
/*globals before,beforeEach,afterEach,describe,it */
"use strict";

var chai = require('chai');
chai.config.includeStack = true;
var expect = chai.expect;
var Fetcher = require('../../../libs/fetcher');
var fetcher;
var mockService = require('../../mock/MockService');
var mockErrorService = require('../../mock/MockErrorService');
var mockNoopService = require('../../mock/MockNoopService');
var qs = require('querystring');
var testCrud = require('../../util/testCrud');

describe('Server Fetcher', function () {
    beforeEach(function () {
        Fetcher.registerService(mockService);
        Fetcher.registerService(mockErrorService);
        Fetcher.registerService(mockNoopService);
    });
    afterEach(function () {
        Fetcher.services = {}; // reset services
    });
    it('should register valid services', function () {
        Fetcher.services = {}; // reset services so we can test getService and registerService methods
        var getService = Fetcher.getService.bind(Fetcher);
        expect(getService).to.throw(Error, 'Service "undefined" could not be found');
        getService = Fetcher.getService.bind(Fetcher, mockService.name);
        expect(getService).to.throw(Error, 'Service "' + mockService.name + '" could not be found');
        expect(Object.keys(Fetcher.services)).to.have.length(0);
        Fetcher.registerService(mockService);
        expect(Object.keys(Fetcher.services)).to.have.length(1);
        expect(getService()).to.deep.equal(mockService);
        Fetcher.registerService(mockErrorService);
        expect(Object.keys(Fetcher.services)).to.have.length(2);

        // valid vs invalid
        var invalidService = {not_name: 'test_name'};
        var validService = {name: 'test_name'};
        var registerInvalidService = Fetcher.registerService.bind(Fetcher, undefined);
        expect(registerInvalidService).to.throw(Error, 'Service is not defined correctly');
        registerInvalidService = Fetcher.registerService.bind(Fetcher, invalidService);
        expect(registerInvalidService).to.throw(Error, 'Service is not defined correctly');
        var registerValidService = Fetcher.registerService.bind(Fetcher, validService);
        expect(registerValidService).to.not.throw;
    });

    it('should get services by resource and sub resource', function () {
        var getService = Fetcher.getService.bind(Fetcher, mockService.name);
        expect(getService).to.not.throw;
        expect(getService()).to.deep.equal(mockService);
        getService = Fetcher.getService.bind(Fetcher, mockService.name + '.subResource');
        expect(getService).to.not.throw;
        expect(getService()).to.deep.equal(mockService);
    });

    it('should be able to update options for the fetchr instance', function () {
        fetcher = new Fetcher({ req: {} });
        expect(fetcher.options.req.foo).to.be.undefined;
        fetcher.updateOptions({req: {foo: 'bar'}});
        expect(fetcher.options.req.foo).to.equal('bar');
        fetcher = null;
    });

    describe('should be backwards compatible', function () {
        it('#registerFetcher & #getFetcher', function () {
            Fetcher.services = {}; // reset services so we can test getFetcher and registerFetcher methods
            var getFetcher = Fetcher.getFetcher.bind(Fetcher, mockService.name);
            expect(getFetcher).to.throw;
            Fetcher.registerFetcher(mockService);
            expect(getFetcher).to.not.throw;
            expect(getFetcher()).to.deep.equal(mockService);
            getFetcher = Fetcher.getFetcher.bind(Fetcher, mockService.name + '.subResource');
            expect(getFetcher).to.not.throw;
            expect(getFetcher()).to.deep.equal(mockService);
        });
    });


    describe('#middleware', function () {
        describe('#POST', function() {
            var stats = null;
            var statsCollector = function (s) {
                stats = s;
            };
            beforeEach(function () {
                stats = null;
            });
            it('should respond to POST api request', function (done) {
                var operation = 'create',
                    statusCodeSet = false,
                    req = {
                        method: 'POST',
                        path: '/' + mockService.name,
                        body: {
                            requests: {
                                g0: {
                                    resource: mockService.name,
                                    operation: operation,
                                    params: {
                                        uuids: ['cd7240d6-aeed-3fed-b63c-d7e99e21ca17', 'cd7240d6-aeed-3fed-b63c-d7e99e21ca17'],
                                        id: 'asdf'
                                    }
                                }
                            },
                            context: {
                                site: '',
                                device: ''
                            }
                        }
                    },
                    res = {
                        json: function(response) {
                            expect(response).to.exist;
                            expect(response).to.not.be.empty;
                            var data = response.g0.data;
                            expect(data).to.contain.keys('operation', 'args');
                            expect(data.operation.name).to.equal(operation);
                            expect(data.operation.success).to.be.true;
                            expect(data.args).to.contain.keys('params');
                            expect(data.args.params).to.equal(req.body.requests.g0.params);
                            expect(statusCodeSet).to.be.true;
                            expect(stats.resource).to.eql(mockService.name);
                            expect(stats.operation).to.eql(operation);
                            expect(stats.statusCode).to.eql(200);
                            expect(stats.time).to.be.at.least(0);
                            expect(stats.params).to.eql(req.body.requests.g0.params);
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
                    middleware = Fetcher.middleware({
                        statsCollector: statsCollector
                    });

                middleware(req, res, next);
            });

            it('should respond to POST api request with custom status code and custom headers', function (done) {
                var operation = 'create',
                    statusCode = 201,
                    statusCodeSet = false,
                    responseHeaders = {'x-foo': 'foo'},
                    headersSet,
                    req = {
                        method: 'POST',
                        path: '/' + mockService.name,
                        body: {
                            requests: {
                                g0: {
                                    resource: mockService.name,
                                    operation: operation,
                                    params: {
                                        uuids: ['cd7240d6-aeed-3fed-b63c-d7e99e21ca17', 'cd7240d6-aeed-3fed-b63c-d7e99e21ca17'],
                                        id: 'asdf'
                                    }
                                }
                            },
                            context: {
                                site: '',
                                device: ''
                            }
                        }
                    },
                    res = {
                        json: function(response) {
                            expect(response).to.exist;
                            expect(response).to.not.be.empty;
                            var data = response.g0.data;
                            expect(data).to.contain.keys('operation', 'args');
                            expect(data.operation.name).to.equal(operation);
                            expect(data.operation.success).to.be.true;
                            expect(data.args).to.contain.keys('params');
                            expect(data.args.params).to.equal(req.body.requests.g0.params);
                            expect(headersSet).to.eql(responseHeaders);
                            expect(statusCodeSet).to.be.true;
                            expect(stats.resource).to.eql(mockService.name);
                            expect(stats.operation).to.eql(operation);
                            expect(stats.statusCode).to.eql(201);
                            expect(stats.time).to.be.at.least(0);
                            expect(stats.params).to.eql(req.body.requests.g0.params);
                            expect(stats.err).to.eql(null);
                            done();
                        },
                        status: function(code) {
                            expect(code).to.equal(statusCode);
                            statusCodeSet = true;
                            return this;
                        },
                        set: function(headers) {
                            headersSet = headers;
                            return this;
                        },
                        send: function (code) {
                            console.log('Not Expected: middleware responded with', code);
                        }
                    },
                    next = function () {
                        console.log('Not Expected: middleware skipped request');
                    },
                    middleware = Fetcher.middleware({
                        pathPrefix: '/api',
                        statsCollector: statsCollector
                    });

                mockService.meta = {
                    headers: responseHeaders,
                    statusCode: statusCode
                };

                middleware(req, res, next);
            });

            var makePostApiErrorTest = function(params, expStatusCode, expMessage) {
                return function(done) {
                    var operation = 'create',
                        statusCodeSet = false,
                        req = {
                            method: 'POST',
                            path: '/' + mockErrorService.name,
                            body: {
                                requests: {
                                    g0: {
                                        resource: mockErrorService.name,
                                        operation: operation,
                                        params: params
                                    }
                                },
                                context: {
                                    site: '',
                                    device: ''
                                }
                            }
                        },
                        res = {
                            json: function(data) {
                                expect(data).to.eql(expMessage);
                                expect(statusCodeSet).to.be.true;
                                done();
                            },
                            status: function(code) {
                                expect(code).to.equal(expStatusCode);
                                statusCodeSet = true;
                                return this;
                            },
                            send: function (data) {
                                console.log('send() not expected: middleware responded with', data);
                            }
                        },
                        next = function () {
                            console.log('next() not expected: middleware skipped request');
                        },
                        middleware = Fetcher.middleware({pathPrefix: '/api'});
                    middleware(req, res, next);
                };
            };

            it('should respond to POST api request with default error details',
               makePostApiErrorTest({}, 500, {message: 'request failed'}));

            it('should respond to POST api request with custom error status code',
               makePostApiErrorTest({statusCode: 400}, 400, {message: 'request failed'}));

            it('should respond to POST api request with custom error message',
               makePostApiErrorTest({message: 'Error message...'}, 500, {message: 'Error message...'}));

            it('should respond to POST api request with no leaked error information',
               makePostApiErrorTest({statusCode: 400, danger: 'zone'}, 400, {message: 'request failed'}));


            describe('should respond to POST api request with custom output', function() {
                it('using json object',
                   makePostApiErrorTest({statusCode: 400, output: {
                      message: 'custom message',
                      foo    : 'bar',
                   }}, 400, {message: 'custom message', 'foo': 'bar'}));

                it('using json array',
                   makePostApiErrorTest({statusCode: 400, output: [1, 2]}, 400, [1, 2]));
            });
        });


        describe('#GET', function() {
            it('should respond to GET api request w/o meta', function (done) {
                var operation = 'read';
                var statusCodeSet = false;
                var params = {
                        uuids: ['cd7240d6-aeed-3fed-b63c-d7e99e21ca17', 'cd7240d6-aeed-3fed-b63c-d7e99e21ca17'],
                        id: 'asdf'
                    };
                var req = {
                         method: 'GET',
                         path: '/' + mockService.name + ';' + qs.stringify(params, ';'),
                         query: {}
                    };
                var res = {
                        json: function(response) {
                            expect(response).to.exist;
                            expect(response).to.not.be.empty;
                            expect(response).to.not.contain.keys('data', 'meta');
                            expect(response).to.contain.keys('operation', 'args');
                            expect(response.operation.name).to.equal(operation);
                            expect(response.operation.success).to.be.true;
                            expect(response.args).to.contain.keys('params');
                            expect(response.args.params).to.deep.equal(params);
                            expect(statusCodeSet).to.be.true;
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
                    };
                var next = function () {
                        console.log('Not Expected: middleware skipped request');
                    };
                var middleware = Fetcher.middleware({pathPrefix: '/api'});

                middleware(req, res, next);
            });
            it('should respond to GET api request', function (done) {
                var operation = 'read',
                    statusCodeSet = false,
                    params = {
                        uuids: ['cd7240d6-aeed-3fed-b63c-d7e99e21ca17', 'cd7240d6-aeed-3fed-b63c-d7e99e21ca17'],
                        id: 'asdf',
                    },
                    req = {
                        method: 'GET',
                        path: '/' + mockService.name + ';' + qs.stringify(params, ';'),
                        query: {
                            returnMeta: true
                        }
                    },
                    res = {
                        json: function(response) {
                            expect(response).to.exist;
                            expect(response).to.not.be.empty;
                            expect(response).to.contain.keys('data', 'meta');
                            expect(response.data).to.contain.keys('operation', 'args');
                            expect(response.data.operation.name).to.equal(operation);
                            expect(response.data.operation.success).to.be.true;
                            expect(response.data.args).to.contain.keys('params');
                            expect(response.data.args.params).to.deep.equal(params);
                            expect(response.meta).to.be.empty;
                            expect(statusCodeSet).to.be.true;
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
            });

            it('should respond to GET api request with custom status code and custom headers', function (done) {
                var operation = 'read',
                    statusCodeSet = false,
                    statusCode = 201,
                    responseHeaders = {'Cache-Control': 'max-age=300'},
                    headersSet,
                    params = {
                        uuids: ['cd7240d6-aeed-3fed-b63c-d7e99e21ca17', 'cd7240d6-aeed-3fed-b63c-d7e99e21ca17'],
                        id: 'asdf',
                    },
                    req = {
                        method: 'GET',
                        path: '/' + mockService.name + ';' + qs.stringify(params, ';'),
                        query: {
                            returnMeta: true
                        }
                    },
                    res = {
                        json: function(response) {
                            expect(response).to.exist;
                            expect(response).to.not.be.empty;
                            expect(response).to.contain.keys('data', 'meta');
                            expect(response.data).to.contain.keys('operation', 'args');
                            expect(response.data.operation.name).to.equal(operation);
                            expect(response.data.operation.success).to.be.true;
                            expect(response.data.args).to.contain.keys('params');
                            expect(response.data.args.params).to.deep.equal(params);
                            expect(response.meta).to.eql({
                                headers: responseHeaders,
                                statusCode: statusCode
                            });
                            expect(statusCodeSet).to.be.true;
                            expect(headersSet).to.eql(responseHeaders);
                            done();
                        },
                        set: function(headers) {
                            headersSet = headers;
                            return this;
                        },
                        status: function(code) {
                            expect(code).to.equal(statusCode);
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

                mockService.meta = {
                    headers: responseHeaders,
                    statusCode: statusCode
                };
                middleware(req, res, next);
            });

            it('should leave big integers in query params as strings', function (done) {
                var operation = 'read',
                    statusCodeSet = false,
                    params = {
                        id: '123456789012345', // will not cause rounding errors
                        bigId: '1234567890123456789' // will cause rounding erros
                    },
                    req = {
                        method: 'GET',
                        path: '/' + mockService.name + ';' + qs.stringify(params, ';'),
                        query: {
                            returnMeta: true
                        }
                    },
                    res = {
                        json: function(response) {
                            expect(response).to.exist;
                            expect(response).to.not.be.empty;
                            expect(response).to.contain.keys('data', 'meta');
                            expect(response.data).to.contain.keys('operation', 'args');
                            expect(response.data.operation.name).to.equal(operation);
                            expect(response.data.operation.success).to.be.true;
                            expect(response.data.args).to.contain.keys('params');
                            expect(response.data.args.params.id).to.be.an('number');
                            expect(response.data.args.params.id.toString()).to.equal(params.id);
                            expect(response.data.args.params.bigId).to.be.an('string');
                            expect(response.data.args.params.bigId.toString()).to.equal(params.bigId);
                            expect(statusCodeSet).to.be.true;
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
            });

            it('should leave big decimal in query params as strings', function (done) {
                var operation = 'read',
                    statusCodeSet = false,
                    params = {
                        decimal: '9007199254740991', // will not cause rounding errors
                        bigDecimal: '9007199254740991.11111' // will cause rounding erros
                    },
                    req = {
                        method: 'GET',
                        path: '/' + mockService.name + ';' + qs.stringify(params, ';'),
                        query: {
                            returnMeta: true
                        }
                    },
                    res = {
                        json: function(response) {
                            expect(response).to.exist;
                            expect(response).to.not.be.empty;
                            expect(response).to.contain.keys('data', 'meta');
                            expect(response.data).to.contain.keys('operation', 'args');
                            expect(response.data.operation.name).to.equal(operation);
                            expect(response.data.operation.success).to.be.true;
                            expect(response.data.args).to.contain.keys('params');
                            expect(response.data.args.params.decimal).to.be.an('number');
                            expect(response.data.args.params.decimal.toString()).to.equal('9007199254740991');
                            expect(response.data.args.params.bigDecimal).to.be.an('string');
                            expect(response.data.args.params.bigDecimal.toString()).to.equal('9007199254740991.11111');
                            expect(statusCodeSet).to.be.true;
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
            });

            it('should leave exponential notation in query params as strings', function (done) {
                var operation = 'read',
                    statusCodeSet = false,
                    params = {
                        num: '1234e1234',
                    },
                    req = {
                        method: 'GET',
                        path: '/' + mockService.name + ';' + qs.stringify(params, ';'),
                        query: {
                            returnMeta: true
                        }
                    },
                    res = {
                        json: function(response) {
                            expect(response).to.exist;
                            expect(response).to.not.be.empty;
                            expect(response).to.contain.keys('data', 'meta');
                            expect(response.data).to.contain.keys('operation', 'args');
                            expect(response.data.operation.name).to.equal(operation);
                            expect(response.data.operation.success).to.be.true;
                            expect(response.data.args).to.contain.keys('params');
                            expect(response.data.args.params.num).to.be.an('string');
                            expect(response.data.args.params.num.toString()).to.equal('1234e1234');
                            expect(statusCodeSet).to.be.true;
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
            });

            var paramsToQuerystring = function(params) {
                var str = '';
                for (var key in params) {
                    str += ';' + key + '=' + JSON.stringify(params[key]);
                }

                return str;
            };

            var makeGetApiErrorTest = function(params, expStatusCode, expMessage) {
                return function(done) {
                    var operation = 'read',
                        statusCodeSet = false,

                        req = {
                            method: 'GET',
                            path: '/' + mockErrorService.name + paramsToQuerystring(params),
                            params: params,
                        },

                        res = {
                            json: function(data) {
                                expect(data).to.eql(expMessage);
                                expect(statusCodeSet).to.be.true;
                                done();
                            },
                            status: function(code) {
                                expect(code).to.equal(expStatusCode);
                                statusCodeSet = true;
                                return this;
                            },
                            send: function (data) {
                                console.log('send() not expected: middleware responded with', data);
                            }
                        },
                        next = function () {
                            console.log('Not Expected: middleware skipped request');
                        },
                        middleware = Fetcher.middleware({pathPrefix: '/api'});
                    middleware(req, res, next);
                };
            };

            it('should respond to GET api request with default error details',
               makeGetApiErrorTest({}, 500, {message: 'request failed'}));

            it('should respond to GET api request with custom error status code',
               makeGetApiErrorTest({statusCode: 400}, 400, {message: 'request failed'}));

            it('should respond to GET api request with no leaked error information',
               makeGetApiErrorTest({statusCode: 400, danger: 'zone'}, 400, {message: 'request failed'}));

            it('should respond to GET api request with custom error message',
               makeGetApiErrorTest({message: 'Error message...'}, 500, {message: 'Error message...'}));

            describe('should respond to GET api request with custom output', function() {
                it('using json object',
                   makeGetApiErrorTest({statusCode: 400, output: {
                      message: 'custom message',
                      foo    : 'bar',
                   }}, 400, {message: 'custom message', 'foo': 'bar'}));

                it('using json array',
                   makeGetApiErrorTest({statusCode: 400, output: [1, 2]}, 400, [1, 2]));
            });
        });

        describe('Invalid Access', function () {
            function makeInvalidReqTest(req, debugMsg, done) {
                var res = {};
                var next = function (err) {
                    expect(err).to.exist;
                    expect(err).to.be.an('object');
                    expect(err.debug).to.contain(debugMsg);
                    expect(err.message).to.equal('Invalid Fetchr Access');
                    expect(err.statusCode).to.equal(400);
                    expect(err.source).to.equal('fetchr');
                    done();
                };
                var middleware = Fetcher.middleware();
                middleware(req, res, next);
            }
            it('should skip empty url', function (done) {
                makeInvalidReqTest({method: 'GET', path: '/'}, 'Bad resource', done);
            });
            it('should skip invalid GET resource', function (done) {
                makeInvalidReqTest({method: 'GET', path: '/invalidService'}, 'Bad resource invalidService', done);
            });
            it('should sanitize resource name for invalid GET resource', function (done) {
                makeInvalidReqTest({method: 'GET', path: '/invalid&Service'}, 'Bad resource invalid*Service', done);
            });
            it('should skip invalid POST request', function (done) {
                makeInvalidReqTest({method: 'POST', body: {
                    requests: {
                        g0: {
                            resource: 'invalidService'
                        }
                    }
                }}, 'Bad resource invalidService', done);
            });
            it('should sanitize invalid POST request', function (done) {
                makeInvalidReqTest({method: 'POST', body: {
                    requests: {
                        g0: {
                            resource: 'invalid&Service'
                        }
                    }
                }}, 'Bad resource invalid*Service', done);
            });
            it('should handle unsupported operation', function (done) {
                makeInvalidReqTest({method: 'POST', body: {
                    requests: {
                        g0: {
                            resource: mockErrorService.name,
                            operation: 'constructor'
                        }
                    }
                }}, 'Unsupported operation : operation must be create or read or update or delete', done);
            });
            it('should skip POST request with empty req.body.requests object', function (done) {
                makeInvalidReqTest({method: 'POST', body: { requests: {}}}, 'No resources', done);
            });
            it('should skip POST request with no req.body.requests object', function (done) {
                makeInvalidReqTest({method: 'POST'}, 'No resources', done);
            });

        });

        describe('Response Formatter', function () {
            describe('GET', function () {
                it('should modify the response object', function (done) {
                    var operation = 'read';
                    var statusCodeSet = false;
                    var params = {
                            uuids: ['cd7240d6-aeed-3fed-b63c-d7e99e21ca17', 'cd7240d6-aeed-3fed-b63c-d7e99e21ca17'],
                            id: 'asdf'
                        };
                    var req = {
                             method: 'GET',
                             path: '/' + mockService.name + ';' + qs.stringify(params, ';'),
                             query: {
                                 returnMeta: true
                             }
                        };
                    var res = {
                            json: function(response) {
                                expect(response).to.exist;
                                expect(response).to.not.be.empty;
                                expect(response).to.contain.keys('data', 'meta', 'modified');
                                expect(response.data).to.contain.keys('operation', 'args');
                                expect(response.data.operation.name).to.equal(operation);
                                expect(response.data.operation.success).to.be.true;
                                expect(response.data.args).to.contain.keys('params');
                                expect(response.data.args.params).to.deep.equal(params);
                                expect(response.meta).to.be.empty;
                                expect(statusCodeSet).to.be.true;
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
                        };
                    var next = function () {
                            console.log('Not Expected: middleware skipped request');
                        };
                    var middleware = Fetcher.middleware({responseFormatter: function (req, res, data) {
                            data.modified = true;
                            return data;
                        }});

                    middleware(req, res, next);
                });
            });
            describe('POST', function () {
                it('should modify the response object', function (done) {
                    var operation = 'create',
                        statusCodeSet = false,
                        req = {
                            method: 'POST',
                            path: '/' + mockService.name,
                            body: {
                                requests: {
                                    g0: {
                                        resource: mockService.name,
                                        operation: operation,
                                        params: {
                                            uuids: ['cd7240d6-aeed-3fed-b63c-d7e99e21ca17', 'cd7240d6-aeed-3fed-b63c-d7e99e21ca17'],
                                            id: 'asdf'
                                        }
                                    }
                                },
                                context: {
                                    site: '',
                                    device: ''
                                }
                            }
                        },
                        res = {
                            json: function(response) {
                                expect(response).to.exist;
                                expect(response).to.not.be.empty;
                                expect(response.g0).to.contain.keys('data', 'meta', 'modified');
                                var data = response.g0.data;
                                expect(data).to.contain.keys('operation', 'args');
                                expect(data.operation.name).to.equal(operation);
                                expect(data.operation.success).to.be.true;
                                expect(data.args).to.contain.keys('params');
                                expect(data.args.params).to.equal(req.body.requests.g0.params);
                                expect(statusCodeSet).to.be.true;
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
                        middleware = Fetcher.middleware({responseFormatter: function (req, res, data) {
                            data.modified = true;
                            return data;
                        }});

                    middleware(req, res, next);
                });
            });
        });
    });

    describe('Params Processor', function () {
        it('GET: should process the params object', function (done) {
            var operation = 'read';
            var statusCodeSet = false;
            var params = {
                    uuids: ['cd7240d6-aeed-3fed-b63c-d7e99e21ca17', 'cd7240d6-aeed-3fed-b63c-d7e99e21ca17'],
                    id: 'asdf'
                };
            var req = {
                     method: 'GET',
                     path: '/' + mockService.name + ';' + qs.stringify(params, ';'),
                     query: {
                         returnMeta: true
                     }
                };
            var res = {
                    json: function(response) {
                        expect(response).to.exist;
                        expect(response).to.not.be.empty;
                        expect(response).to.contain.keys('data', 'meta');
                        expect(response.data).to.contain.keys('operation', 'args');
                        expect(response.data.operation.name).to.equal(operation);
                        expect(response.data.operation.success).to.be.true;
                        expect(response.data.args).to.contain.keys('params');
                        expect(response.data.args.params.uuids).to.deep.equal(params.uuids);
                        expect(response.data.args.params.id).to.equal(params.id);
                        expect(response.data.args.params.newParam).to.equal('YES!', JSON.stringify(response.data.args.params));
                        // expect(response.meta).to.be.empty;
                        expect(statusCodeSet).to.be.true;
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
                };
            var next = function () {
                    console.log('Not Expected: middleware skipped request');
                };
            var middleware = Fetcher.middleware({paramsProcessor: function (req, serviceInfo, params) {
                    return Object.assign({}, params, {newParam: 'YES!'});
                }});

            middleware(req, res, next);
        });

        it('POST: should process the params object', function (done) {
            var operation = 'create';
            var statusCodeSet = false;
            var params = {
                    uuids: ['cd7240d6-aeed-3fed-b63c-d7e99e21ca17', 'cd7240d6-aeed-3fed-b63c-d7e99e21ca17'],
                    id: 'asdf'
                };
            var req = {
                     method: 'POST',
                     path: '/' + mockService.name + ';' + qs.stringify(params, ';'),
                     body: {
                         requests: {
                             g0: {
                                 resource: mockService.name,
                                 operation: operation,
                                 params: {
                                     uuids: ['cd7240d6-aeed-3fed-b63c-d7e99e21ca17', 'cd7240d6-aeed-3fed-b63c-d7e99e21ca17'],
                                     id: 'asdf'
                                 }
                             }
                         },
                         context: {
                             site: '',
                             device: ''
                         }
                     }
                };
            var res = {
                    json: function(response) {
                        expect(response).to.exist;
                        expect(response).to.not.be.empty;
                        expect(response.g0).to.contain.keys('data', 'meta');
                        var data = response.g0.data;
                        expect(data).to.contain.keys('operation', 'args');
                        expect(data.operation.name).to.equal(operation);
                        expect(data.operation.success).to.be.true;
                        expect(data.args).to.contain.keys('params');
                        expect(data.args.params).to.include(req.body.requests.g0.params);
                        expect(data.args.params.newParam).to.include('YES!');
                        expect(statusCodeSet).to.be.true;
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
                };
            var next = function () {
                    console.log('Not Expected: middleware skipped request');
                };
            var middleware = Fetcher.middleware({paramsProcessor: function (req, serviceInfo, params) {
                    return Object.assign({}, params, {newParam: 'YES!'});
                }});

            middleware(req, res, next);
        });
    });

    describe('CRUD', function () {
        var resource = mockService.name;
        var params = {};
        var body = {};
        var config = {};
        var callback = function(operation, done) {
            return function(err, data) {
                if (err){
                    done(err);
                }
                expect(data.operation).to.exist;
                expect(data.operation.name).to.equal(operation);
                expect(data.operation.success).to.be.true;
                done();
            };
        };
        var resolve = function (operation, done) {
            return function (result) {
                try {
                    expect(result.data).to.exist;
                    expect(result.data.operation).to.exist;
                    expect(result.data.operation.name).to.equal(operation);
                    expect(result.data.operation.success).to.be.true;
                } catch (e) {
                    done(e);
                    return;
                }
                done();
            };
        };
        var reject = function (operation, done) {
            return function (err) {
                done(err);
            };
        };
        var stats = null;
        var statsCollector = function(s) {
            stats = s;
        };
        var callbackWithStats = function (operation, done) {
            return function (err, data, meta) {
                expect(stats.resource).to.eql(resource);
                expect(stats.operation).to.eql(operation);
                expect(stats.time).to.be.at.least(0);
                expect(stats.err).to.eql(err);
                expect(stats.statusCode).to.eql((err && err.statusCode) || 200);
                expect(stats.params).to.eql(params);
                callback(operation, done)(err, data, meta);
            };
        };
        before(function () {
            this.fetcher = new Fetcher ({
                req: {},
                statsCollector: statsCollector
            });
        });
        beforeEach(function () {
            stats = null;
        });
        // CRUD
        testCrud(params, body, config, callbackWithStats, resolve, reject);
    });

});
