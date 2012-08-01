// caches Mapnik render objects, purging after 60 seconds of inactivity:
var   Step     = require('step')
    , _        = require('underscore')
    , tilelive = require('tilelive');
                 require('tilelive-mapnik').registerProtocols(tilelive);


module.exports = function(timeout, mml_store){

    // Configure bases for cache keys suitable for string interpolation
    var renderKey = "<%= dbname %>:<%= table %>:<%= format %>:<%= geom_type %>:<%= sql %>:<%= interactivity %>:<%= style %>";
    var baseKey   = "<%= dbname %>:<%= table %>:";
    var me = {
        serial: 0,
        renderers: {},
        timeout: timeout || 60000
    };

    me.cacheClearInterval = setInterval( function() {
      var now = Date.now();
      var that = me;
      console.log("cacheClearInterval called, that is " + that + " me.timeout is "  + me.timeout + " that.renderers is " + that.renderers);
      _.each(_.keys(that.renderers), function(key){
          var cache_entry = that.renderers[key];
          if ( now - cache_entry.atime > that.timeout ) {
            that.del(key);
          }
      });
    }, me.timeout );

    // Create a string ID/key from a set of params
    me.createKey = function(params) {
        var opts =  _.extend({}, params); // as params is a weird arrayobj right here
        delete opts.x;
        delete opts.y;
        delete opts.z;
        delete opts.callback;
        _.defaults(opts, {dbname:'', table:'', format:'', geom_type:'', sql:'', interactivity:'', style:''});
        return _.template(renderKey, opts);
    };

    // If renderer exists at key, return it, else generate a new one and save at key.
    // Also sets timeouts to clear renderer if unused.
    me.getRenderer = function(req, callback){

        if ( req.params.cache_buster != this.serial ) {
          this.serial = req.params.cache_buster;
          this.reset(req);
        }

        // setup
        var key  = this.createKey(req.params);
        var that = this;

        var cache_entry = this.renderers[key];
        var now = Date.now(); // consider eventually process.hrtime() too

        if ( ! cache_entry ) {

            // if there is no cache entry for the key
            // 1. register the new cache entry queuing the callback
            // 2. register a timeout to remove the new entry
            // 3. request creation of the renderer

            cache_entry = this.renderers[key] =  {
              ready: false,
              err: null,
              renderer: null,
              atime: now, // last access time
              cb: [ callback ]
            };

            that.makeRenderer(req.params, function(err, data) {

                    // Once the renderer is ready (or there's an error),
                    // invoke all queued callbacks
                    cache_entry.renderer = data;
                    cache_entry.ready = true;

                    var cb;
                    while (cb = cache_entry.cb.shift()) {
                      cb(err, data);
                    }
                    // TODO: update last access time here ?
            });

        }
        else {
            // if there is an existing cache entry
            // 1. reset the cache entry timeout 
            // 2. invoke the callback (or queue a call to it if renderer isn't ready))
          
            if ( cache_entry.ready ) {
              // should we use process.nextTick here ?
              callback(cache_entry.err, cache_entry.renderer);
              cache_entry.atime = now; // update last access time;
            } else {
              cache_entry.cb.push(callback); // queue our callback
            }
        }
    };


    // controls the instantiation of mapnik renderer objects from mapnik XML
    me.makeRenderer = function(params, callback){
        var that = this;

        // create an mapnik mml store object
        var mml_builder = mml_store.mml_builder(params);


        // returns a tilelive renderer by:
        // 1. generating or retrieving mapnik XML
        // 2. configuring a full mml document with mapnik XML, interactivity and other elements set
        Step(
            function generateXML(){
                mml_builder.toXML(this);
            },
            function loadMapnik(err, data){
                if (err) throw err;

                var query = {

                    // TODO: document what `base` is
                    //
                    // TODO: Remove  + Date.now() from base key. It's a hack to ensure styles are updated
                    //
                    base: that.createKey(params) + Date.now(),
          
                    // Metatile is the number of tiles-per-side that are going
                    // to be rendered at once. If all of them will be requested
                    // we'd have saved time. If only one will be used, we'd have
                    // wasted time.
                    //
                    // Defaults to 2 as of tilelive-mapnik@0.3.2
                    //
                    // We'll assume an average of a 4x4 viewport
                    //
                    metatile:4,

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
                    bufferSize:64

                };


                // Check for multiple interactivity columns
                // string: "col1,col2,col3"
                // array: ["col1","col2","col3"]
                //
                // if String, split it
                if (_.isString(params.interactivity)){
                    params.interactivity = params.interactivity.split(",");
                }

                // if Array, clean it
                if (_.isArray(params.interactivity)){
                    params.interactivity = _.compact(params.interactivity);
                }

                // if null, encase in array
                if (_.isNull(params.interactivity)){
                    params.interactivity = [ null ];
                }

                // build full document to pass to tilelive
                var uri = {
                    query: query,
                    protocol: 'mapnik:',
                    slashes: true,
                    xml: data,
                    mml: {
                        interactivity: {
                            layer: params.table,
                            fields: params.interactivity
                        },
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
        var base_key = _.template(baseKey, req.params);
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

        if ( cache_entry.ready && cache_entry.renderer ) {
          // TODO: should we check for cache_entry.cb.length == 0 ?
          // TODO: Is this really safe ? What if rendering is being scheduled
          //       for next process tick ?
          //       Should we use renderer.close() instead ?
          //       
          cache_entry.renderer._pool.destroyAllNow();
        }
    };


    return me;
};
