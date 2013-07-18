// caches Mapnik render objects, purging after 60 seconds of inactivity:
var   Step     = require('step')
    , _        = require('underscore')
    , tilelive = require('tilelive');
                 require('tilelive-mapnik').registerProtocols(tilelive);

function CacheEntry()
{
  this.ready = false;
  this.err = null;
  this.renderer = null;
  this.ctime = this.atime = Date.now(); // last access time
  this.cb = [];
  this._refcount = 0;
  this.id = ('' + Math.random()).substr(5, 4); // this is for debugging only
/*
  console.log("CacheEntry " + this.id + " created");
*/
}

CacheEntry.prototype = Object.create(require('events').EventEmitter.prototype);

CacheEntry.prototype.pushCallback = function(cb) {
  this._addRef();
  if ( this.ready ) {
    cb(this.err, this, true);
    this.setLastUsed(Date.now()); // update last access time;
  } else {
    this.cb.push(cb);
  }
};

// Proxy underlying functions
CacheEntry.prototype.getTile = function() {
  this.renderer.getTile.apply(this.renderer, arguments);
};

// Proxy underlying functions
CacheEntry.prototype.getGrid = function() {
  this.renderer.getGrid.apply(this.renderer, arguments);
};

// Get the contained entry
CacheEntry.prototype.get = function() {
  return this.renderer;
};

CacheEntry.prototype.setReady = function(err, renderer) {
  // consistency check
  if ( this.ready ) throw new Error("Invalid call to CacheEntry.setReady on an ready entry");
  this.ready = true;
  this.err = err;
  this.renderer = renderer;

  var cached = false;
  var cb;
  while (cb = this.cb.shift()) {
    cb(err, this, cached);
    cached = true;
  }

  // TODO: update last access time here ?
  this.emit('ready', this);
};

// Call this as soon as you get a reference to the object
// if you plan to use it for longer than the current tick.
// Call dropRef when finished with it.
CacheEntry.prototype._addRef = function() {
  ++this._refcount;
};

CacheEntry.prototype.release = function() {
  this._dropRef();
};

CacheEntry.prototype._dropRef = function() {
  if ( ! --this._refcount ) {
    this._destroy();
  }
};

CacheEntry.prototype.setLastUsed = function(t) {
  this.atime = t;
};

CacheEntry.prototype.timeSinceLastAccess = function(now) {
  var age = ( now - this.atime );
  return age;
};

// Destroy (now or ASAP) a CacheEntry
//
// TODO: accept a callback ?
//
CacheEntry.prototype._destroy = function() {

  // integrity checks
  if ( this.cb.length ) throw new Error("CacheEntry._destroy was called while still having " + this.cb.length + " callbacks pending");
  if ( this._refcount ) throw new Error("CacheEntry._destroy was called while still having " + this._refcount + " references");

  if ( ! this.ready ) {
    // not ready yet, try later
    //console.log("cache_entry " + this.id + " isn't ready yet, scheduling destruction on 'ready' event");
    this.on('ready', this._destroy.bind(this));
  }
  else if ( ! this.renderer ) {
    // nothing to do
    //console.log("This cache entry is ready but has no renderer, so nothing to do");
  }
  else {
    //console.log("Calling .close on cache_entry " + this.id);
    // TODO: fixme: we can't modify the renderer here because
    //       tilelive-mapnik is keeping an internal cache and
    //       so modifying an object we'd be modifying something
    //       which will possibly be reused later.
    //       See https://github.com/mapbox/tilelive-mapnik/issues/47
    //      
    //this.renderer._pool.destroyAllNow();
    this.renderer.close(function() {}); // TODO: accept a callback ?
  }
};


module.exports = function(timeout, mml_store, mapnik_opts) {

    // Configure bases for cache keys suitable for string interpolation
    var baseKey   = "<%= dbname %>:<%= table %>:";
    var renderKey = baseKey + "<%= dbuser %>:<%= format %>:<%= geom_type %>:<%= sql %>:<%= layer %>:<%= interactivity %>:<%= style %>:<%= style_version %>";

    // Set default mapnik options
    mapnik_opts = _.defaults( mapnik_opts ? mapnik_opts : {}, {

      // Metatile is the number of tiles-per-side that are going
      // to be rendered at once. If all of them will be requested
      // we'd have saved time. If only one will be used, we'd have
      // wasted time.
      //
      // Defaults to 2 as of tilelive-mapnik@0.3.2
      //
      // We'll assume an average of a 4x4 viewport
      metatile: 4,

      // Buffer size is the tickness in pixel of a buffer
      // around the rendered (meta?)tile.
      //
      // This is important for labels and other marker that overlap tile boundaries.
      // Setting to 128 ensures no render artifacts.
      // 64 may have artifacts but is faster.
      // Less important if we can turn metatiling on.
      //
      // defaults to 128 as of tilelive-mapnik@0.3.2
      //
      bufferSize: 64
    });

    var me = {
        serial: 0,
        renderers: {},
        timeout: timeout || 60000,
        mapnik_opts: mapnik_opts
    };

    me.dumpStats = function() {
      var now = Date.now();
      var renderers = me.renderers;
      var timeout = me.timeout;
      var itemkeys = _.keys(renderers);
      var ts = new Date().toUTCString();
      console.log("RenderCache items " + itemkeys.length + " timeout " + timeout + " next gc in " + ( timeout - ( now - me.lastCacheClearRun ) ) );
      _.each(itemkeys, function(key){
        var item = renderers[key];
        console.log(" ItemKey " + key + " ttl " + ( timeout - item.timeSinceLastAccess(now) ) + " cb " + item.cache_buster );
      });
    }

    me.lastCacheClearRun = Date.now();
    me.cacheClearInterval = setInterval( function() {
      var now = Date.now();
      var that = me;
      var itemkeys = _.keys(that.renderers);
      _.each(itemkeys, function(key){
          var cache_entry = that.renderers[key];
          if ( cache_entry.timeSinceLastAccess(now) > that.timeout ) {
            that.del(key);
          }
      });
      // Only dump if verbose ?
      console.log(new Date().toUTCString() + " - RenderCache items: " + _.keys(that.renderers).length + "/" + itemkeys.length);
      me.lastCacheClearRun = now;
    }, me.timeout );

    // Create a string ID/key from a set of params
    me.createKey = function(params, base) {
        var opts =  _.extend({}, params); // as params is a weird arrayobj right here
        delete opts.x;
        delete opts.y;
        delete opts.z;
        delete opts.callback;
        if ( ! opts.table ) opts.table = opts.token;
        _.defaults(opts, {
          dbname:'', dbuser:'', table:'',
          format:'', geom_type:'', sql:'',
          interactivity:'', layer:'', style:'', style_version:''
        });
        var key = _.template(base ? baseKey : renderKey, opts);
        return key;
    };

    // If renderer cache entry exists at req-derived key, return it,
    // else generate a new one and save at key.
    //
    // Caches lifetime is driven by the timeout passed at RendererCache
    // construction time.
    //
    //
    // @param callback will be called with (err, renderer)
    //        If `err` is null the renderer should be
    //        ready for you to use (calling getTile or getGrid).
    //        Note that the object is a proxy to the actual TileStore
    //        so you won't get the whole TileLive interface available.
    //        If you need that, use the .get() function.        
    //        In order to reduce memory usage call renderer.release()
    //        when you're sure you won't need it anymore.
    //                 
    //
    me.getRenderer = function(req, callback) {

        var cache_buster = req.params.cache_buster || 0;

        // setup
        var key  = this.createKey(req.params);

        var cache_entry = this.renderers[key];

        if ( ! cache_entry || cache_entry.cache_buster != cache_buster ) {

            cache_entry = this.renderers[key] = new CacheEntry();
            cache_entry.cache_buster = cache_buster;
            cache_entry.key = key;
            cache_entry._addRef(); // we add another ref for this.renderers[key]

            var that = this;
            Step(
              function invokeHook () {
                if ( ! req.params.processRendererCache ) return true;
                req.params.processRendererCache(cache_entry, req, this);
              },
              function makeRenderer (err) {
                if ( err ) { callback(err); return; }
                that.makeRenderer(req, function(err, renderer) {
                  if ( req.profiler ) req.profiler.done('makeRenderer');
                  cache_entry.setReady(err, renderer);
                });
              }
            );
        }

        cache_entry.pushCallback(callback);
    };


    // controls the instantiation of mapnik renderer objects from mapnik XML
    me.makeRenderer = function(req, callback){
        var that = this;
        var params = _.clone(req.params);
        var mml_builder; 

        // returns a tilelive renderer by:
        // 1. generating or retrieving mapnik XML
        // 2. configuring a full mml document with mapnik XML, interactivity and other elements set
        Step(
            function initBuilder(){
              // create an mapnik mml store object
              mml_builder = mml_store.mml_builder(params, this);
            },
            function updateLastAccessIfToken(err){
                if (err) throw err;
                if ( params.token ) mml_builder.touch(this);
                else return true;
            },
            function generateXML(err){
                if (err) throw err;
                mml_builder.toXML(this);
            },
            function processXML(err, xml){
                if (err) throw err;
                if ( ! xml ) throw new Error("Undefined XML from mml_builder.toXML!");
                if ( params.processXML )
                  params.processXML(req, xml, this);
                else this(null, xml);
            },
            function loadMapnik(err, data){
                if (err) throw err;

                var query = {
                    // TODO: document what `base` is
                    base: that.createKey(params) + '/xia', 
                    metatile: that.mapnik_opts.metatile,
                    bufferSize: that.mapnik_opts.bufferSize,
                    internal_cache: false
                };


                // build full document to pass to tilelive
                var uri = {
                    query: query,
                    protocol: 'mapnik:',
                    slashes: true,
                    xml: data,
                    mml: {
                        format: params.format
                    }
                };

                // hand off to tilelive to create a renderer
                tilelive.load(uri, this);
            },
            function returnCallback(err, source){
                callback(err, source);
            }
        );
    };


    // delete all renderers in cache
    me.purge = function(){
        var that = this;
        _.each(_.keys(that.renderers), function(key){
            that.del(key);
        });
    };


    // Clears out all renderers related to a given table, regardless of other arguments
    me.reset = function(req){
        var base_key = this.createKey(req.params, true); 
        var regex = new RegExp('^' + base_key + '.*');
        var that = this;

        _.each(_.keys(this.renderers), function(key){
            if(key.match(regex)){
                that.del(key);
            }
        });
    };


    // drain render pools, remove renderer and associated timeout calls
    me.del = function(id){
        var cache_entry = this.renderers[id];
        delete this.renderers[id];
        cache_entry.release();
    };


    return me;
};
