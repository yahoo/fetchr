/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
/*jshint expr:true*/
/*globals before,after,describe,it */
"use strict";

var expect = require('chai').expect,
    mockery = require('mockery'),
    Fetcher,
    fetcher;

describe('Client Fetcher', function () {

    describe('#CRUD', function () {
        var resource = 'mock_fetcher',
            params = {
                uuids: [1,2,3,4,5],
                category: '',
                selected_filter: 'YPROP:TOPSTORIES'
            },
            body = { stuff: 'is'},
            context = {
                crumb: 'stuff'
            },
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

        before(function(){
            mockery.registerMock('./util/http.client', {
                get: function (url, headers, config, done) {
                    var urlBase = '/api/resource/',
                        urlParams,
                        pair;
                    expect(url).to.have.string(urlBase);
                    urlParams = url.substr(urlBase.length);
                    urlParams = decodeURIComponent(urlParams);
                    urlParams = urlParams.split(';');
                    expect(urlParams.shift()).to.equal(resource);
                    while(!!(pair = urlParams.shift())) {
                        pair = pair.split('=');

                        var k = pair[0],
                            v = pair[1];

                        //hacky because of array in querystring, but its fine
                        if(k === 'uuids'){
                            expect(params[k].toString()).to.equal(v.substr(1,v.length-2));
                        } else {
                            expect(params[k]).to.equal(v);
                        }
                    }
                    done();
                },
                post : function (url, headers, body, config, callback) {
                    expect(url).to.not.be.empty;
                    expect(callback).to.exist;
                    expect(body).to.exist;
                    expect(url).to.equal('/api?crumb='+context.crumb);

                    var req = body.requests.g0,
                        res = {
                            g0: {
                                data: req
                            }
                        };

                    callback(null, {
                        responseText: JSON.stringify(res)
                    });
                }
            });
            mockery.enable({
                useCleanCache: true,
                warnOnUnregistered: false
            });
            Fetcher = require('../../../libs/fetcher.client');
            fetcher = new Fetcher({
                requireCrumb: true,
                context: context
            });
        });

        after(function(){
            mockery.disable();
            mockery.deregisterAll();
        });

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
            fetcher[operation](resource, params, config, done);
        });
        it('should handle READ w/ no config', function (done) {
            var operation = 'read';
            fetcher[operation](resource, params, done);
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
            fetcher[operation](resource, params, config, callback('delete', done));
        });
        it('should handle DELETE w/ no config', function (done) {
            var operation = 'del';
            fetcher[operation](resource, params, callback('delete', done));
        });
    });

});
