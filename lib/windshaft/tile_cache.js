// tile cache policies
// it exports two cache types:
// 'nocache' implements a pass-troguth cache
// 'lru' implements a LRU cache

var LRUCache       = require('./lru'),
    CacheValidator = require('./cache_validator')

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

module.exports.LRUcache = function(max_items, redis_opts) {
    var cache_validator = CacheValidator(redis_opts);
    return GenericCache(new LRUCache(max_items), cache_validator);
}

// implements a generic cache for tile
// cache_policy should implement set and get methods and optionally getStats
function GenericCache (cache_policy, cache_validator) {

    var me = {
        cache: cache_policy,
        cache_validator: cache_validator,
        cache_hits: 0,
        cache_misses: 0,
        current_items: 0,
        cache_invalidated: 0,
        max_items: 0
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
            // validate the cache
            me.cache_validator.getTimestamp(req.params.dbname, req.params.table, function(err, t) {
                if(t != null && tile.timestamp < t) {
                    me.cache_misses++;
                    me.cache_invalidated++;
                    callback(null);
                } else {
                    me.cache_hits++;
                    res.header('X-Cache-hit', 'true');
                    res.send(tile.tile, tile.headers, 200);
                }
            });
        } else {
            me.cache_misses++;
            callback(null);
        }
    }

    me.afterTileRender = function(req, res, tile, headers, callback) {
        var timestamp = new Date().getTime()/1000.0;
        me.cache.put(cache_key(req), { tile: tile, headers: headers, timestamp: timestamp});
        update_items(me.cache.size || 0);
        callback(null, tile, headers);
    }

    me.afterStateChange = function(req, data, callback) {
        console.log("invalidating", req.params.dbname,", ", req.params.table);
        me.cache_validator.setTimestamp(req.params.dbname, req.params.table, new Date().getTime()/1000.0, function(err, t) {
            callback(err, data);
        });
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
             memory: mem,
             memory_per_item: total ? mem/total: 0,
             ratio: total ? me.cache_hits/total: 0
        };
    }

    return me;
}
