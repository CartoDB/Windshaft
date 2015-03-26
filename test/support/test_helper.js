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


var redisClient = redis.createClient(global.environment.redis.port);

afterEach(function(done) {
    // Check that we start with an empty redis db
    redisClient.keys("*", function(err, matches) {
        if ( err ) {
            return done(err);
        }
        assert.equal(matches.length, 0, "redis keys present at setup time:\n" + matches.join("\n"));
        redisClient.flushall(done);
    });
});
