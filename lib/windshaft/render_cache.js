// caches Mapnik render objects, purging after 60 seconds of inactivity:
var   _                     = require('underscore')
    , CacheEntry            = require('./cache/cache_entry')
    , Step                  = require('step')
    , tilelive              = require('tilelive')
    , TorqueRendererFactory = require('./renderers/torque').factory;

require('tilelive-mapnik').registerProtocols(tilelive);

module.exports = function(options, mml_store, map_store, mapnik_opts) {

    var COLUMN_NAME_GEOMETRY = 'geometry';

    var COLUMN_NAME_DEFAULT = global.environment.postgres.geometry_field || 'the_geom_webmercator';
    var COLUMN_TYPE_DEFAULT = COLUMN_NAME_GEOMETRY;

    var MAPNIK_COLUMN_NAME = '__cdb_the_geom';

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

    var torqueFactory = new TorqueRendererFactory(); // TODO: specify options

    var me = {
        serial: 0,
        renderers: {},
        timeout: options.timeout || 60000,
        mapnik_opts: mapnik_opts,
        statsInterval: options.statsInterval || 60000
    };

    me.dumpStats = function() {
      var now = Date.now();
      var renderers = me.renderers;
      var timeout = me.timeout;
      var itemkeys = _.keys(renderers);
      console.log("RenderCache items " + itemkeys.length + " timeout " + timeout + " next gc in " + ( timeout - ( now - me.lastCacheClearRun ) ) );
      _.each(itemkeys, function(key){
        var item = renderers[key];
        console.log(" ItemKey " + key + " ttl " + ( timeout - item.timeSinceLastAccess(now) ) + " cb " + item.cache_buster );
      });
    };

    me.lastCacheClearRun = Date.now();
    me.cacheClearInterval = setInterval( function() {
      var now = Date.now();
      _.each(me.renderers, function(cache_entry, key) {
          if ( cache_entry.timeSinceLastAccess(now) > me.timeout ) {
            me.del(key);
          }
      });
      me.lastCacheClearRun = now;
    }, me.timeout );

    me.renderersStatsIntervalId = setInterval(function() {
        global.statsClient.gauge('windshaft.rendercache.count', _.keys(me.renderers).length);

        var poolStats = _.reduce(
            _.filter(me.renderers, function(cacheEntry) {
                return cacheEntry.renderer
                    && cacheEntry.renderer.constructor == TileliveAdaptor
                    && cacheEntry.renderer.renderer._pool;
            }),
            function(_poolStats, cacheEntry) {
                _poolStats.count += cacheEntry.renderer.renderer._pool.getPoolSize();
                _poolStats.unused += cacheEntry.renderer.renderer._pool.availableObjectsCount();
                _poolStats.waiting += cacheEntry.renderer.renderer._pool.waitingClientsCount();
                return _poolStats;
            },
            {
                count: 0,
                unused: 0,
                waiting: 0
            }
        );

        global.statsClient.gauge('windshaft.mapnik-pool.count', poolStats.count);
        global.statsClient.gauge('windshaft.mapnik-pool.unused', poolStats.unused);
        global.statsClient.gauge('windshaft.mapnik-pool.waiting', poolStats.waiting);
    }, me.statsInterval);

    // Create a string ID/key from a set of params
    me.createKey = function(params, base) {
        var opts =  _.extend({}, params); // as params is a weird arrayobj right here
        delete opts.x;
        delete opts.y;
        delete opts.z;
        delete opts.callback;
        if ( ! opts.table ) {
          opts.table = opts.token;
          // interactivity is encoded in token
          delete opts.interactivity;
        }
        _.defaults(opts, {
          dbname:'', dbuser:'', table:'',
          format:'', geom_type:'', sql:'',
          interactivity:'', layer:'', style:'', style_version:''
        });
        return _.template(base ? baseKey : renderKey, opts);
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

        var params = req.params;
        var cache_buster = this.getCacheBusterValue(params.cache_buster);

        // setup
        var key  = this.createKey(params);

        var cache_entry = this.renderers[key];

        if (this.shouldRecreateRenderer(cache_entry, cache_buster)) {

            cache_entry = this.renderers[key] = new CacheEntry();
            cache_entry.cache_buster = cache_buster;
            cache_entry.key = key; // TODO: drop, is unused
            cache_entry._addRef(); // we add another ref for this.renderers[key]

            var that = this;

            cache_entry.on('error', function(err) {
              console.log("Removing RendererCache " + key + " on error " + err);
              that.del(key);
            });

            Step(
              function invokeHook () {
                if ( ! params.processRendererCache ) return true;
                params.processRendererCache(cache_entry, req, this);
              },
              function makeRenderer (err) {
                if ( err ) { callback(err); return; }
                that.makeRenderer(req, function(err, renderer) {
                  if (!err && req.profiler) {
                      req.profiler.done('makeRenderer-'+req.params.format.replace('.','_'));
                  }
                  cache_entry.setReady(err, renderer);
                });
              }
            );
        }

        cache_entry.pushCallback(callback);
    };

    me.getCacheBusterValue = function(cache_buster) {
        if (_.isUndefined(cache_buster)) {
            return 0;
        }
        if (_.isNumber(cache_buster)) {
            return Math.min(this._getMaxCacheBusterValue(), cache_buster);
        }
        return cache_buster;
    };

    me._getMaxCacheBusterValue = function() {
        return Date.now();
    };

    me.shouldRecreateRenderer = function(cacheEntry, cacheBuster) {
        if (cacheEntry) {
            var entryCacheBuster = parseFloat(cacheEntry.cache_buster),
                requestCacheBuster = parseFloat(cacheBuster);

            if (isNaN(entryCacheBuster) || isNaN(requestCacheBuster)) {
                return cacheEntry.cache_buster != cacheBuster;
            }
            return requestCacheBuster > entryCacheBuster;
        }
        return true;
    };

    me.dbParamsFromReqParams = function(params) {
        var dbParams = {};
        if ( params.dbuser ) dbParams.user = params.dbuser;
        if ( params.dbpassword ) dbParams.pass = params.dbpassword;
        if ( params.dbhost ) dbParams.host = params.dbhost;
        if ( params.dbport ) dbParams.port = params.dbport;
        if ( params.dbname ) dbParams.dbname = params.dbname;
        return dbParams;
    };

    function prepareQuery(userSql, geomType, geomColumn) {

        var query = [
            '(WITH inner_cdbq as (' + userSql + ')',
                'SELECT *, ' + geomColumn + ' ' + MAPNIK_COLUMN_NAME,
                'FROM inner_cdbq',
            ') as cdbq'
        ];

        if (geomType === COLUMN_NAME_GEOMETRY) {
            if (!!global.environment.renderer.snapToGrid && !!global.environment.renderer.clipByBox2d) {
                query = [
                    '(WITH inner_cdbq as (' + userSql + ')',
                        'SELECT *,',
                        'CASE WHEN CDB_ScaleDenominatorToZoom(!scale_denominator!) > 8',
                            'THEN ST_SnapToGrid(ST_ClipByBox2D(' + geomColumn + ', !bbox!), greatest(!pixel_width!,!pixel_height!)/20.0)',
                            'ELSE ST_SnapToGrid(' + geomColumn + ', greatest(!pixel_width!,!pixel_height!)/20.0)',
                        'END ' + MAPNIK_COLUMN_NAME,
                        'FROM inner_cdbq',
                    ') AS cdbq'
                ];
            } else if (!!global.environment.renderer.snapToGrid) {
                query = [
                    '(WITH inner_cdbq as (' + userSql + ')',
                        'SELECT *, ST_SnapToGrid(' + geomColumn + ', greatest(!pixel_width!,!pixel_height!)/20.0) ' + MAPNIK_COLUMN_NAME,
                        'FROM inner_cdbq',
                    ') AS cdbq'
                ];
            }
        }

        return query.join(' ');
    }

    me.mapConfigToMMLBuilderConfig = function(mapConfig) {
        var cfg = mapConfig.obj();
        var sql = [];
        var style = [];
        var geom_columns = [];
        var extra_ds_opts = [];
        var interactivity = [];
        var style_version = cfg.hasOwnProperty('global_cartocss_version') ? cfg.global_cartocss_version : [];
        for ( var i=0; i<cfg.layers.length; ++i ) {

          var lyr = cfg.layers[i];

          if ( mapConfig.layerType(i) != 'mapnik' ) continue;

          if ( ! lyr.hasOwnProperty('options') )
            throw new Error("Missing options from layer " + i + " of layergroup config");
          var lyropt = lyr.options;

          if ( ! lyropt.hasOwnProperty('cartocss') )
            throw new Error("Missing cartocss for layer " + i + " options");
          style.push(lyropt.cartocss);
          if ( _.isArray(style_version) ) {
            if ( ! lyropt.hasOwnProperty('cartocss_version') ) {
              throw new Error("Missing cartocss_version for layer " + i + " options");
            }
            style_version.push(lyropt.cartocss_version);
          }

          // NOTE: interactivity used to be a string as of version 1.0.0
          if ( _.isArray(lyropt.interactivity) ) {
            lyropt.interactivity = lyropt.interactivity.join(',');
          } 
          interactivity.push(lyropt.interactivity);

          if ( ! lyropt.hasOwnProperty('sql') ) {
            throw new Error("Missing sql for layer " + i + " options");
          }

          var geomColumn = lyropt['geom_column'] || COLUMN_NAME_DEFAULT;
          var geomType = lyropt['geom_type'] || COLUMN_TYPE_DEFAULT;

          // Wrap SQL requests in mapnik format if sent
          sql.push(prepareQuery(lyropt.sql.replace(/;\s*$/, ''), geomType, geomColumn));

          geom_columns.push({
              type: geomType, // grainstore allows undefined here
              name: MAPNIK_COLUMN_NAME
          });

          var extra_opt = {};
          if ( lyropt.hasOwnProperty('raster_band') ) {
            extra_opt['band'] = lyropt['raster_band'];
          }
          extra_ds_opts.push( extra_opt );
        }
        if ( ! sql.length ) throw new Error("No 'mapnik' layers in MapConfig");
        var opts = {
            sql: sql,
            style: style,
            style_version: style_version,
            interactivity: interactivity,
            ttl: 0,
            extra_ds_opts: extra_ds_opts
        };
        if (geom_columns.length) {
            opts.gcols = geom_columns;
        }

        return opts;
    };

    function TileliveAdaptor(renderer, format) {
      this.renderer = renderer;
      this.close = this.renderer.close.bind(this.renderer);
      this.get = function() { return renderer; };
      if ( format == 'png' ) {
        this.getTile = this.renderer.getTile.bind(this.renderer);
      }
      else if ( format == 'grid.json' ) {
        this.getTile = this.renderer.getGrid.bind(this.renderer);
      }
      else throw new Error("Unsupported format " + format);
    }

    // controls the instantiation of mapnik renderer objects from mapnik XML
    me.makeRendererMapnik = function(req, callback){
        var that = this;
        var params = _.extend({}, req.params);
        var mml_builder; 

        // returns a tilelive renderer by:
        // 1. generating or retrieving mapnik XML
        // 2. configuring a full mml document with mapnik XML, interactivity and other elements set
        Step(
            function getConfig(){
              if ( ! params.token ) return null;
              map_store.load(params.token, this);
            },
            function initBuilder(err, mapConfig) {
              if (err) throw err;
              if ( params.token ) {
                delete params.interactivity; // will be rewritten from MapConfig
                params = _.defaults(params, that.mapConfigToMMLBuilderConfig(mapConfig));
                delete params.token;
              }
              // create an mapnik mml builder object
              mml_builder = mml_store.mml_builder(params, this);
            },
            function generateXML(err){
                if (err) throw err;
                mml_builder.toXML(this);
            },
            function loadMapnik(err, data){
                if (!err && req.profiler) {
                    req.profiler.done('generateXML');
                }

                if (err) throw err;

                var query = {
                    // TODO: document what `base` is
                    base: that.createKey(params) + '/xia', 
                    metatile: that.mapnik_opts.metatile,
                    bufferSize: that.mapnik_opts.bufferSize,
                    autoLoadFonts: false,
                    internal_cache: false
                };


                // build full document to pass to tilelive
                var uri = {
                    query: query,
                    protocol: 'mapnik:',
                    slashes: true,
                    xml: data,
                    strict: !!params.strict, // force boolean
                    mml: {
                        format: params.format // this seems to be useless
                    }
                };

                // hand off to tilelive to create a renderer
                tilelive.load(uri, this);
            },
            function makeAdaptor(err, source){
                if (!err && req.profiler) {
                    req.profiler.done('tilelive-load');
                }
                if ( err ) throw err;
                return new TileliveAdaptor(source, params.format);
            },
            function returnCallback(err, source){
                callback(err, source);
            }
        );
    };

    function TorqueAdaptor(renderer) {
      this.renderer = renderer;
      this.close = function() { /* nothing to do */ };
      this.get = function() { return renderer; };
      this.getTile = this.renderer.getTile.bind(this.renderer);
    }

    // controls the instantiation of mapnik renderer objects from mapnik XML
    me.makeRendererTorque = function(req, callback){
        var that = this;
        var params = _.extend({}, req.params);
        if ( ! params.token || ! params.hasOwnProperty('layer') ) {
          callback(new Error("Torque renderer can only be initialized with map token and layer id"));
          return;
        }

        Step(
            function getConfig(){
              map_store.load(params.token, this);
            },
            function initRenderer(err, mapConfig) {
              if (err) throw err;
              var dbParams = that.dbParamsFromReqParams(params);
              var format = params.format;
              var layer = params.layer;
              torqueFactory.getRenderer(mapConfig.obj(), dbParams, format, layer, this);
            },
            function makeAdaptor(err, renderer){
                if ( err ) throw err;
                return new TorqueAdaptor(renderer);
            },
            function returnCallback(err, renderer){
                callback(err, renderer);
            }
        );
    };

    me.makeRenderer = function(req, callback){
      var params = req.params;
      if ( params.format.match(/^(png|grid\.json)$/) ) {
        me.makeRendererMapnik(req, callback);
      }
      else if ( params.format.match(/torque/) ) {
        me.makeRendererTorque(req, callback);
      }
      else {
        callback(new Error("Unsupported format " + params.format));
      }
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
