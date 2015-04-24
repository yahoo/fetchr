/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
/*jshint expr:true*/
/*globals before,after,describe,it */
"use strict";

var libUrl = require('url');
var expect = require('chai').expect,
    mockery = require('mockery'),
    Fetcher,
    fetcher;

var app = require('../../mock/app');
var corsApp = require('../../mock/corsApp');
var supertest = require('supertest');
var request = require('request');
var qs = require('qs');
var resource = 'mock_service';

describe('Client Fetcher', function () {

    before(function () {
        mockery.enable({
            useCleanCache: true,
            warnOnUnregistered: false
        });
    });

    describe('#CRUD', function () {

        function testCrud (resource, params, body, config, callback) {
           it('should handle CREATE', function (done) {
                var operation = 'create';
                fetcher[operation](resource, params, body, config, callback(operation, done));
            });
            it('should handle READ', function (done) {
                var operation = 'read';
                fetcher[operation](resource, params, config, callback(operation, done));
            });
            it('should handle UPDATE', function (done) {
                var operation = 'update';
                fetcher[operation](resource, params, body, config, callback(operation, done));
            });
            it('should handle DELETE', function (done) {
                var operation = 'delete';
                fetcher[operation](resource, params, config, callback(operation, done));
            });
        }

        describe('with CORS', function () {
            var corsPath = 'http://localhost:3001';
            var params = {
                    uuids: ['1','2','3','4','5'],
                    corsDomain: 'test1'
                },
                body = { stuff: 'is'},
                context = {
                    _csrf: 'stuff'
                },
                callback = function(operation, done) {
                    return function(err, data) {
                        if (err){
                            done(err);
                        }
                        if (data) {
                            expect(data).to.deep.equal(params);
                        }
                        done();
                    };
                };

            before(function(){
                mockery.resetCache();
                mockery.registerMock('./util/http.client', {
                    get: function (url, headers, config, done) {
                        expect(url).to.contain(corsPath);
                        request(url, function (err, res, body) {
                            if (err) throw err;
                            expect(res.statusCode).to.equal(200);
                            done(null, {
                                responseText: body
                            });
                        });
                    },
                    post : function (url, headers, body, config, done) {
                        expect(url).to.not.be.empty;
                        expect(url).to.equal(corsPath + '?_csrf=' + context._csrf);
                        expect(callback).to.exist;
                        expect(body).to.exist;
                        request.post({
                            url: url,
                            body: JSON.stringify(body)
                        }, function (err, res, respBody) {
                            if (err) throw err;
                            expect(res.statusCode).to.equal(200);
                            done(null, {
                                responseText: respBody
                            });
                        });
                    }
                });

                Fetcher = require('../../../libs/fetcher.client');
                fetcher = new Fetcher({
                    context: context,
                    corsPath: corsPath
                });
            });

            after(function() {
                mockery.deregisterAll();
            });

            function constructGetUri (uri, resource, params, config) {
                if (config.cors) {
                    return uri + '/' + resource + '?' + qs.stringify(params, { arrayFormat: 'repeat' });
                }
            }

            testCrud(resource, params, body, {
                cors: true,
                constructGetUri: constructGetUri
            }, callback);
        });

        describe('without CORS', function () {
            var params = {
                    uuids: [1,2,3,4,5],
                    object: {
                        nested: {
                            object: true
                        }
                    },
                    category: '',
                    selected_filter: 'YPROP:TOPSTORIES'
                },
                body = { stuff: 'is'},
                context = {
                    _csrf: 'stuff'
                },
                callback = function(operation, done) {
                    return function(err, data) {
                        if (err){
                            done(err);
                        }
                        expect(data.operation).to.exist;
                        expect(data.operation.name).to.equal(operation);
                        expect(data.operation.success).to.equal(true);
                        expect(data.args).to.exist;
                        expect(data.args.resource).to.equal(resource);
                        expect(data.args.params).to.eql(params);
                        done();
                    };
                };

            before(function(){
                mockery.resetCache();
                mockery.registerMock('./util/http.client', {
                    get: function (url, headers, config, done) {
                        supertest(app)
                            .get(url)
                            .expect(200)
                            .end(function (err, res) {
                                if (err) throw err;
                                done(null, {
                                    responseText: res.text
                                });
                            });
                    },
                    post : function (url, headers, body, config, done) {
                        expect(url).to.not.be.empty;
                        expect(url).to.equal('/api?_csrf='+context._csrf);
                        expect(callback).to.exist;
                        expect(body).to.exist;
                        supertest(app)
                            .post(url)
                            .send(body)
                            .expect(200)
                            .end(function (err, res) {
                                if (err) throw err;
                                done(null, {
                                    responseText: res.text
                                });
                            });
                    }
                });

                Fetcher = require('../../../libs/fetcher.client');
                fetcher = new Fetcher({
                    context: context
                });
            });

            after(function() {
                mockery.deregisterAll();
                app.cleanup();
            });

            testCrud(resource, params, body, {}, callback);

            it('should handle CREATE w/ no config', function (done) {
                var operation = 'create';
                fetcher[operation](resource, params, body, callback(operation, done));
            });
            it('should handle READ w/ no config', function (done) {
                var operation = 'read';
                fetcher[operation](resource, params, callback(operation, done));
            });
            it('should handle UPDATE w/ no config', function (done) {
                var operation = 'update';
                fetcher[operation](resource, params, body, callback(operation, done));
            });
            it('should handle DELETE w/ no config', function (done) {
                var operation = 'delete';
                fetcher[operation](resource, params, callback(operation, done));
            });
        });
    });

    after(function () {
        mockery.disable();
    });

});
