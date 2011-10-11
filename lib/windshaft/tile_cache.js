// tile cache policies
// it exports two cache types:
// 'nocache' implements a pass-troguth cache
// 'lru' implements a LRU cache

var LRUCache = require('./lru');

module.exports.NoCache = function() {

    var me = {}

    me.beforeTileRender = function(req, res, callback) {
        callback(null);
    }

    me.afterTileRender = function(req, res, tile, headers, callback) {
        callback(null, tile, headers);
    }

    return me;

}

module.exports.LRUcache = function(max_items) {
    return GenericCache(new LRUCache(max_items));
}

// implements a generic cache for tile
// cache_policy should implement set and get methods and optionally getStats
function GenericCache (cache_policy) {

    var me = {
        cache: cache_policy,
        cache_hits: 0,
        cache_misses: 0,
        current_items: 0,
        max_items: 0
        //memory: 0
    }
    
    function cache_key(req) {
        return req.url;
    }

    function update_items(n) {
        me.current_items = n;
        if(n > me.max_items) {
            me.max_items = n;
        }
    }

    me.beforeTileRender = function(req, res, callback) {
        var key = cache_key(req);
        var tile = me.cache.get(key);
        if(tile) {
            me.cache_hits++;
            res.header('X-Cache-hit', 'true');
            res.send(tile.tile, tile.headers, 200);
        } else {
            me.cache_misses++;
            callback(null);
        }
    }

    me.afterTileRender = function(req, res, tile, headers, callback) {
        me.cache.put(cache_key(req), { tile: tile, headers: headers});
        update_items(me.cache.size || 0);
        callback(null, tile, headers);
    }

    me.getStats = function() {
        var total = me.cache_hits + me.cache_misses;
      var mem = 0;
      me.cache.forEach(function(key, value) {
        mem += value.tile.length;
      });
      return  {
             cache_hits: me.cache_hits,
             cache_misses: me.cache_misses,
             current_items: me.current_items,
             max_items: me.max_items,
            //TODO
             memory: mem,
             memory_per_item: total ? mem/total: 0,
             ratio: total ? me.cache_hits/total: 0
        };
    }
    
    return me;
}
