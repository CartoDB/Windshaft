'use strict';

/**
 * User: simon
 * Date: 30/08/2011
 * Time: 13:52
 * Desc: Loads test specific variables
 */

var assert = require('assert');
var redis = require('redis');

// set environment specific variables
global.settings = require(__dirname + '/../../config/settings');
global.environment = require(__dirname + '/../../config/environments/test');
global.settings = Object.assign(global.settings, global.environment);
process.env.NODE_ENV = 'test';

var redisClient;
beforeEach(function () {
    if (!redisClient) {
        redisClient = redis.createClient(global.environment.redis.port);
    }
});

// global afterEach to capture tests that leave keys in redis
afterEach(function (done) {
    // Check that we start with an empty redis db
    redisClient.keys('*', function (err, keys) {
        if (err) {
            return done(err);
        }
        assert.equal(keys.length, 0, 'test left objects in redis:\n' + keys.join('\n'));
        redisClient.flushall(done);
    });
});
