var crypto = require('crypto')
  , redis  = require('redis')
  , _      = require('underscore')
  , Pool   = require('generic-pool').Pool;

// RedisPool constructor. 
// 
// - `opts` {Object} optional config for redis and pooling
var RedisPool = function(opts){
  var opts = opts || {};
  var defaults = {
    host: '127.0.0.1', 
    port: '6379', 
    max: 50, 
    idleTimeoutMillis: 10000, 
    reapIntervalMillis: 1000, 
    log: false
  };    
  var options = _.defaults(opts, defaults)

  var me = {
    pools: {} // cached pools by DB name
  };
  
  // Acquire resource.
  //
  // - `database` {String} redis database name
  // - `callback` {Function} callback to call once acquired. Takes the form
  //   `callback(err, resource)`  
  me.acquire = function(database, callback) {
      if (!this.pools[database]) {
        this.pools[database] = this.makePool(database);            
      }
      this.pools[database].acquire(function(err,resource) {
        callback(err, resource);
      });
  };
  
  // Release resource.
  //
  // - `database` {String} redis database name
  // - `resource` {Object} resource object to release
  me.release = function(database, resource) {
      this.pools[database] && this.pools[database].release(resource);
  };
    
  // Factory for pool objects.
  me.makePool = function(database) {
    return Pool({
      name: database,
      create: function(callback){
        var client = redis.createClient(options.port, options.host);          
        client.on('connect', function () {
          client.send_anyway = true;
          client.select(database);  
          client.send_anyway = false;
        });    
        return callback(null, client);
      },
      destroy: function(client) { 
        return client.quit(); 
      },
      max: options.max, 
      idleTimeoutMillis: options.idleTimeoutMillis, 
      reapIntervalMillis: options.reapIntervalMillis, 
      log: options.log 
    });
  };
      
  return me;
}

module.exports = RedisPool;