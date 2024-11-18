const expect = require('chai').expect;
const defaultOptions = require('./defaultOptions');
const resource = defaultOptions.resource;
const invalidResource = 'invalid_resource';
const mockErrorService = require('../mock/MockErrorService');
const mockNoopService = require('../mock/MockNoopService');

module.exports = function testCrud({
    params = defaultOptions.params,
    body = defaultOptions.body,
    config = defaultOptions.config,
    callback = defaultOptions.callback,
    resolve = defaultOptions.resolve,
    reject = defaultOptions.reject,
    disableNoConfigTests = false,
}) {
    describe('CRUD Interface', function () {
        describe('should work superagent style', function () {
            describe('with callbacks', function () {
                it('should handle CREATE', function (done) {
                    const operation = 'create';
                    this.fetcher[operation](resource)
                        .params(params)
                        .body(body)
                        .clientConfig(config)
                        .end(callback(operation, done));
                });

                it('should handle READ', function (done) {
                    const operation = 'read';
                    this.fetcher[operation](resource)
                        .params(params)
                        .clientConfig(config)
                        .end(callback(operation, done));
                });

                it('should handle UPDATE', function (done) {
                    const operation = 'update';
                    this.fetcher[operation](resource)
                        .params(params)
                        .body(body)
                        .clientConfig(config)
                        .end(callback(operation, done));
                });

                it('should handle DELETE', function (done) {
                    const operation = 'delete';
                    this.fetcher[operation](resource)
                        .params(params)
                        .clientConfig(config)
                        .end(callback(operation, done));
                });

                it('should throw if no resource is given', function () {
                    expect(this.fetcher.read.bind(this.fetcher)).to.throw(
                        'Resource is required for a fetcher request',
                    );
                });
            });

            describe('with Promises', function () {
                function denySuccess(done) {
                    return function () {
                        done(new Error('This operation should have failed'));
                    };
                }

                function allowFailure(done) {
                    return function (err) {
                        expect(err.name).to.equal('FetchrError');
                        expect(err.message).to.exist;
                        done();
                    };
                }

                it('should handle CREATE', function (done) {
                    const operation = 'create';
                    this.fetcher[operation](resource)
                        .params(params)
                        .body(body)
                        .clientConfig(config)
                        .then(
                            resolve(operation, done),
                            reject(operation, done),
                        );
                });

                it('should handle READ', function (done) {
                    const operation = 'read';
                    this.fetcher[operation](resource)
                        .params(params)
                        .clientConfig(config)
                        .then(
                            resolve(operation, done),
                            reject(operation, done),
                        );
                });

                it('should handle UPDATE', function (done) {
                    const operation = 'update';
                    this.fetcher[operation](resource)
                        .params(params)
                        .body(body)
                        .clientConfig(config)
                        .then(
                            resolve(operation, done),
                            reject(operation, done),
                        );
                });

                it('should handle DELETE', function (done) {
                    const operation = 'delete';
                    this.fetcher[operation](resource)
                        .params(params)
                        .clientConfig(config)
                        .then(
                            resolve(operation, done),
                            reject(operation, done),
                        );
                });

                it('should reject a CREATE promise on invalid resource', function (done) {
                    const operation = 'create';
                    this.fetcher[operation](invalidResource)
                        .params(params)
                        .body(body)
                        .clientConfig(config)
                        .then(denySuccess(done), allowFailure(done));
                });

                it('should reject a READ promise on invalid resource', function (done) {
                    const operation = 'read';
                    this.fetcher[operation](invalidResource)
                        .params(params)
                        .clientConfig(config)
                        .then(denySuccess(done), allowFailure(done));
                });

                it('should reject a UPDATE promise on invalid resource', function (done) {
                    const operation = 'update';
                    this.fetcher[operation](invalidResource)
                        .params(params)
                        .body(body)
                        .clientConfig(config)
                        .then(denySuccess(done), allowFailure(done));
                });

                it('should reject a DELETE promise on invalid resource', function (done) {
                    const operation = 'delete';
                    this.fetcher[operation](invalidResource)
                        .params(params)
                        .clientConfig(config)
                        .then(denySuccess(done), allowFailure(done));
                });

                it('should throw if no resource is given', function () {
                    expect(this.fetcher.read.bind(this.fetcher)).to.throw(
                        'Resource is required for a fetcher request',
                    );
                });
            });
        });

        describe('should be backwards compatible', function () {
            function denySuccess(done) {
                return function (err) {
                    if (!err) {
                        done(new Error('This operation should have failed'));
                    } else {
                        expect(err.name).to.equal('FetchrError');
                        expect(err.message).to.exist;
                        done();
                    }
                };
            }

            // with config
            it('should handle CREATE', function (done) {
                const operation = 'create';
                this.fetcher[operation](
                    resource,
                    params,
                    body,
                    config,
                    callback(operation, done),
                );
            });

            it('should handle READ', function (done) {
                const operation = 'read';
                this.fetcher[operation](
                    resource,
                    params,
                    config,
                    callback(operation, done),
                );
            });

            it('should handle UPDATE', function (done) {
                const operation = 'update';
                this.fetcher[operation](
                    resource,
                    params,
                    body,
                    config,
                    callback(operation, done),
                );
            });

            it('should handle DELETE', function (done) {
                const operation = 'delete';
                this.fetcher[operation](
                    resource,
                    params,
                    config,
                    callback(operation, done),
                );
            });

            it('should throw catchable error on CREATE with invalid resource', function (done) {
                const operation = 'create';
                this.fetcher[operation](
                    invalidResource,
                    params,
                    body,
                    config,
                    denySuccess(done),
                );
            });

            it('should throw catchable error on READ with invalid resource', function (done) {
                const operation = 'read';
                this.fetcher[operation](
                    invalidResource,
                    params,
                    config,
                    denySuccess(done),
                );
            });

            it('should throw catchable error on UPDATE with invalid resource', function (done) {
                const operation = 'update';
                this.fetcher[operation](
                    invalidResource,
                    params,
                    body,
                    config,
                    denySuccess(done),
                );
            });

            it('should throw catchable error on DELETE with invalid resource', function (done) {
                const operation = 'delete';
                this.fetcher[operation](
                    invalidResource,
                    params,
                    config,
                    denySuccess(done),
                );
            });

            if (!disableNoConfigTests) {
                // without config
                // we have a feature flag to disable these tests because
                // it doesn't make sense to test a feature like CORS without being able to pass in a config
                it('should handle CREATE w/ no config', function (done) {
                    const operation = 'create';
                    this.fetcher[operation](
                        resource,
                        params,
                        body,
                        callback(operation, done),
                    );
                });

                it('should handle READ w/ no config', function (done) {
                    const operation = 'read';
                    this.fetcher[operation](
                        resource,
                        params,
                        callback(operation, done),
                    );
                });

                it('should handle UPDATE w/ no config', function (done) {
                    const operation = 'update';
                    this.fetcher[operation](
                        resource,
                        params,
                        body,
                        callback(operation, done),
                    );
                });

                it('should handle DELETE w/ no config', function (done) {
                    const operation = 'delete';
                    this.fetcher[operation](
                        resource,
                        params,
                        callback(operation, done),
                    );
                });
            }
        });

        it('should keep track of metadata in getServiceMeta', function (done) {
            const fetcher = this.fetcher;
            fetcher._serviceMeta.length = 0; // reset serviceMeta to empty array
            fetcher
                .read(resource)
                .params({
                    ...params,
                    meta: { headers: { 'x-foo': 'foo' } },
                })
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
                        .params({
                            ...params,
                            meta: { headers: { 'x-bar': 'bar' } },
                        })
                        .clientConfig(config)
                        .end(function (err, data, meta) {
                            if (err) {
                                done(err);
                            }
                            expect(meta).to.include.keys('headers');
                            expect(meta.headers).to.include.keys('x-bar');
                            expect(meta.headers['x-bar']).to.equal('bar');
                            const serviceMeta = fetcher.getServiceMeta();
                            expect(serviceMeta).to.have.length(2);
                            expect(serviceMeta[0].headers).to.include.keys(
                                'x-foo',
                            );
                            expect(serviceMeta[0].headers['x-foo']).to.equal(
                                'foo',
                            );
                            expect(serviceMeta[1].headers).to.include.keys(
                                'x-bar',
                            );
                            expect(serviceMeta[1].headers['x-bar']).to.equal(
                                'bar',
                            );
                            done();
                        });
                });
        });

        describe('should have serviceMeta data on error', function () {
            it('with callbacks', function (done) {
                const fetcher = this.fetcher;
                fetcher._serviceMeta.length = 0; // reset serviceMeta to empty array
                fetcher
                    .read(mockErrorService.resource)
                    .params({
                        ...params,
                        meta: { headers: { 'x-foo': 'foo' } },
                    })
                    .clientConfig(config)
                    .end(function (err) {
                        if (err) {
                            const serviceMeta = fetcher.getServiceMeta();
                            expect(serviceMeta).to.have.length(1);
                            expect(serviceMeta[0]).to.include.keys('headers');
                            expect(serviceMeta[0].headers).to.include.keys(
                                'x-foo',
                            );
                            expect(serviceMeta[0].headers['x-foo']).to.equal(
                                'foo',
                            );
                            done();
                        }
                    });
            });

            it('with Promises', function (done) {
                const fetcher = this.fetcher;
                fetcher._serviceMeta.length = 0; // reset serviceMeta to empty array
                fetcher
                    .read(mockErrorService.resource)
                    .params({
                        ...params,
                        meta: { headers: { 'x-foo': 'foo' } },
                    })
                    .clientConfig(config)
                    .catch(function (err) {
                        if (err) {
                            const serviceMeta = fetcher.getServiceMeta();
                            expect(serviceMeta).to.have.length(1);
                            expect(serviceMeta[0]).to.include.keys('headers');
                            expect(serviceMeta[0].headers).to.include.keys(
                                'x-foo',
                            );
                            expect(serviceMeta[0].headers['x-foo']).to.equal(
                                'foo',
                            );
                            done();
                        }
                    });
            });
        });
    });

    describe('should reject no operation service', function () {
        it('with callback', function (done) {
            const fetcher = this.fetcher;
            fetcher
                .read(mockNoopService.resource)
                .clientConfig(config)
                .end(function (err) {
                    expect(err.name).to.equal('FetchrError');
                    expect(err.message).to.contain(
                        'operation: read is undefined on service: mock_noop_service',
                    );
                    done();
                });
        });

        it('with Promise', function (done) {
            const fetcher = this.fetcher;
            fetcher
                .read(mockNoopService.resource)
                .clientConfig(config)
                .catch(function (err) {
                    expect(err.name).to.equal('FetchrError');
                    expect(err.message).to.contain(
                        'operation: read is undefined on service: mock_noop_service',
                    );
                    done();
                });
        });
    });
};
