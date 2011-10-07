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

function GenericCache (cache_policy) {

    var me = {
        cache: cache_policy
    }
    
    function cache_key(req) {
        return req.url;
    }

    me.beforeTileRender = function(req, res, callback) {
        var key = cache_key(req);
        var tile = me.cache.get(key);
        if(tile) {
            res.header('X-Cache-hit');
            res.send(tile.tile, tile.headers, 200);
        } else {
            callback(null);
        }
    }

    me.afterTileRender = function(req, res, tile, headers, callback) {
        me.cache.put(cache_key(req), { tile: tile, headers: headers});
        callback(null, tile, headers);
    }
    
    return me;
}
