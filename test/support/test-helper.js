'use strict';

var assert = require('assert');
var redis = require('redis');
var TestClient = require('./test-client');

var redisClient;
beforeEach(function () {
    if (!redisClient) {
        redisClient = redis.createClient(TestClient.redisOptions.port);
    }
});

afterEach(function (done) {
    redisClient.keys('*', function (err, keys) {
        if (err) {
            return done(err);
        }
        assert.equal(keys.length, 0, 'test left objects in redis:\n' + keys.join('\n'));
        redisClient.flushall(done);
    });
});
