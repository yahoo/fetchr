var expect = require('chai').expect;
var lodash = require('lodash');

var mockService = require('../mock/MockService');
var resource = mockService.name;

var params = {
        uuids: ['1','2','3','4','5'],
        meta: {
            headers: {
                'x-foo-bar': 'foobar'
            }
        },
        missing: undefined
    };
var body = { stuff: 'is'};
var config = {};
var callback = function (operation, done) {
        return function (err, data, meta) {
            if (err){
                return done(err);
            }
            expect(data.operation).to.exist;
            expect(data.operation.name).to.equal(operation);
            expect(data.operation.success).to.be.true;
            expect(data.args).to.exist;
            expect(data.args.resource).to.equal(resource);
            expect(data.args.params).to.eql(lodash.omitBy(params, lodash.isUndefined));
            expect(meta).to.eql(params.meta);
            done();
        };
    };
var resolve = function (operation, done) {
    return function (result) {
        try {
            expect(result).to.exist;
            expect(result).to.have.keys('data', 'meta');
            expect(result.data.operation).to.exist;
            expect(result.data.operation.name).to.equal(operation);
            expect(result.data.operation.success).to.be.true;
            expect(result.data.args).to.exist;
            expect(result.data.args.resource).to.equal(resource);
            expect(result.data.args.params).to.eql(lodash.omitBy(params, lodash.isUndefined));
            expect(result.meta).to.eql(params.meta);
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

module.exports.resource = resource;
module.exports.params = params;
module.exports.body = body;
module.exports.config = config;
module.exports.callback = callback;
module.exports.resolve = resolve;
module.exports.reject = reject;
