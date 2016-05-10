var expect = require('chai').expect;
var defaultOptions = require('./defaultOptions');
var resource = defaultOptions.resource;
var mockErrorService = require('../mock/MockErrorService');
var _ = require('lodash');
module.exports = function testCrud (params, body, config, callback, resolve, reject) {
    var options = {};
    if (arguments.length === 1) {
        options = params;
        params = options.params || defaultOptions.params;
        body = options.body || defaultOptions.body;
        config = options.config || defaultOptions.config;
        callback = options.callback || defaultOptions.callback;
        resolve = options.resolve || defaultOptions.resolve;
        reject = options.reject || defaultOptions.reject;
    }
    describe('CRUD Interface', function () {
        describe('should work superagent style', function () {
            describe('with callbacks', function () {
                it('should handle CREATE', function (done) {
                    var operation = 'create';
                    this.fetcher
                        [operation](resource)
                        .params(params)
                        .body(body)
                        .clientConfig(config)
                        .end(callback(operation, done));
                });
                it('should handle READ', function (done) {
                    var operation = 'read';
                    this.fetcher
                        [operation](resource)
                        .params(params)
                        .clientConfig(config)
                        .end(callback(operation, done));
                });
                it('should handle UPDATE', function (done) {
                    var operation = 'update';
                    this.fetcher
                        [operation](resource)
                        .params(params)
                        .body(body)
                        .clientConfig(config)
                        .end(callback(operation, done));
                });
                it('should handle DELETE', function (done) {
                    var operation = 'delete';
                    this.fetcher
                        [operation](resource)
                        .params(params)
                        .clientConfig(config)
                        .end(callback(operation, done));
                });
                it('should throw if no resource is given', function () {
                    expect(this.fetcher.read.bind(this.fetcher)).to.throw('Resource is required for a fetcher request');
                });
            });

            describe('with Promises', function () {
                it('should handle CREATE', function (done) {
                    var operation = 'create';
                    this.fetcher
                        [operation](resource)
                        .params(params)
                        .body(body)
                        .clientConfig(config)
                        .end()
                        .then(resolve(operation, done), reject(operation, done));
                });
                it('should handle READ', function (done) {
                    var operation = 'read';
                    this.fetcher
                        [operation](resource)
                        .params(params)
                        .clientConfig(config)
                        .end()
                        .then(resolve(operation, done), reject(operation, done));
                });
                it('should handle UPDATE', function (done) {
                    var operation = 'update';
                    this.fetcher
                        [operation](resource)
                        .params(params)
                        .body(body)
                        .clientConfig(config)
                        .end()
                        .then(resolve(operation, done), reject(operation, done));
                });
                it('should handle DELETE', function (done) {
                    var operation = 'delete';
                    this.fetcher
                        [operation](resource)
                        .params(params)
                        .clientConfig(config)
                        .end()
                        .then(resolve(operation, done), reject(operation, done));
                });
                it('should throw if no resource is given', function () {
                    expect(this.fetcher.read).to.throw('Resource is required for a fetcher request');
                });
            });
        });
        describe('should be backwards compatible', function (done) {
            // with config
            it('should handle CREATE', function (done) {
                var operation = 'create';
                this.fetcher[operation](resource, params, body, config, callback(operation, done));
            });
            it('should handle READ', function (done) {
                var operation = 'read';
                this.fetcher[operation](resource, params, config, callback(operation, done));
            });
            it('should handle UPDATE', function (done) {
                var operation = 'update';
                this.fetcher[operation](resource, params, body, config, callback(operation, done));
            });
            it('should handle DELETE', function (done) {
                var operation = 'delete';
                this.fetcher[operation](resource, params, config, callback(operation, done));
            });
            if (!options.disableNoConfigTests) {
                // without config
                // we have a feature flag to disable these tests because
                // it doesn't make sense to test a feature like CORS without being able to pass in a config
                it('should handle CREATE w/ no config', function (done) {
                    var operation = 'create';
                    this.fetcher[operation](resource, params, body, callback(operation, done));
                });
                it('should handle READ w/ no config', function (done) {
                    var operation = 'read';
                    this.fetcher[operation](resource, params, callback(operation, done));
                });
                it('should handle UPDATE w/ no config', function (done) {
                    var operation = 'update';
                    this.fetcher[operation](resource, params, body, callback(operation, done));
                });
                it('should handle DELETE w/ no config', function (done) {
                    var operation = 'delete';
                    this.fetcher[operation](resource, params, callback(operation, done));
                });
            }
        });
        it('should keep track of metadata in getServiceMeta', function (done) {
            var fetcher = this.fetcher;
            fetcher._serviceMeta.length = 0; // reset serviceMeta to empty array
            fetcher
            .read(resource)
            .params(_.merge({}, params, {
                meta: {
                    headers: {
                        'x-foo': 'foo'
                    }
                }
            }))
            .clientConfig(config)
            .end(function (err, data, meta) {
                if (err) {
                    done(err);
                }
                expect(meta).to.include.keys('headers');
                expect(meta.headers).to.include.keys('x-foo');
                expect(meta.headers['x-foo']).to.equal('foo');
                fetcher
                .read(resource)
                .params(_.merge({}, params, {
                    meta: {
                        headers: {
                            'x-bar': 'bar'
                        }
                    }
                }))
                .clientConfig(config)
                .end(function (err, data, meta) {
                    if (err) {
                        done(err);
                    }
                    expect(meta).to.include.keys('headers');
                    expect(meta.headers).to.include.keys('x-bar');
                    expect(meta.headers['x-bar']).to.equal('bar');
                    var serviceMeta = fetcher.getServiceMeta();
                    expect(serviceMeta).to.have.length(2);
                    expect(serviceMeta[0].headers).to.include.keys('x-foo');
                    expect(serviceMeta[0].headers['x-foo']).to.equal('foo');
                    expect(serviceMeta[1].headers).to.include.keys('x-bar');
                    expect(serviceMeta[1].headers['x-bar']).to.equal('bar');
                    done();
                });
            });
        });
        describe('should have serviceMeta data on error', function() {
            it('with callbacks', function (done) {
                var fetcher = this.fetcher;
                fetcher._serviceMeta.length = 0; // reset serviceMeta to empty array
                fetcher
                  .read(mockErrorService.name)
                  .params(_.merge({}, params, {
                      meta: {
                          headers: {
                              'x-foo': 'foo'
                          }
                      }
                  }))
                  .clientConfig(config)
                  .end(function (err) {
                      if (err) {
                          var serviceMeta = fetcher.getServiceMeta();
                          expect(serviceMeta).to.have.length(1);
                          expect(serviceMeta[0]).to.include.keys('headers');
                          expect(serviceMeta[0].headers).to.include.keys('x-foo');
                          expect(serviceMeta[0].headers['x-foo']).to.equal('foo');
                          done();
                      }
                  });
            });
            it('with Promises', function (done) {
                var fetcher = this.fetcher;
                fetcher._serviceMeta.length = 0; // reset serviceMeta to empty array
                fetcher
                  .read(mockErrorService.name)
                  .params(_.merge({}, params, {
                      meta: {
                          headers: {
                              'x-foo': 'foo'
                          }
                      }
                  }))
                  .clientConfig(config)
                  .end()
                  .catch(function (err) {
                      if (err) {
                          var serviceMeta = fetcher.getServiceMeta();
                          expect(serviceMeta).to.have.length(1);
                          expect(serviceMeta[0]).to.include.keys('headers');
                          expect(serviceMeta[0].headers).to.include.keys('x-foo');
                          expect(serviceMeta[0].headers['x-foo']).to.equal('foo');
                          done();
                      }
                  });
            });
        });
    });
};
