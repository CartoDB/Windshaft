/**
 * User: simon
 * Date: 30/08/2011
 * Time: 13:52
 * Desc: Loads test specific variables
 */

var _ = require('underscore');
var assert = require('assert');
var redis = require('redis');

// set environment specific variables
global.settings     = require(__dirname + '/../../config/settings');
global.environment  = require(__dirname + '/../../config/environments/test');
_.extend(global.settings, global.environment);
process.env.NODE_ENV = 'test';


// global afterEach to capture tests that leave keys in redis
afterEach(function(done) {
    var redisClient = redis.createClient(global.environment.redis.port);
    // Check that we start with an empty redis db
    redisClient.keys("*", function(err, keys) {
        if ( err ) {
            return done(err);
        }
        assert.equal(keys.length, 0, "test left objects in redis:\n" + keys.join("\n"));
        redisClient.flushall(done);
    });
});
