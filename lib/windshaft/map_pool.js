var Pool = require('generic-pool').Pool
    , Step = require('step')
    , _ = require('underscore')
    , tilelive   = require('tilelive');
require('tilelive-mapnik').registerProtocols(tilelive);

// Generate a pool of 10 mapniks
var MapPool = function(mml_store){

    var mml_store = mml_store;
    var me = { pools: {} };

    // Create a string ID from a datasource.
    me.makeId = function(options) {
        var opts = _.clone(options);
        delete opts.x;
        delete opts.y;
        delete opts.z;
        return JSON.stringify(opts);
    };

    // Acquire preconfigured mapnik resource.
    // - `options` {Object} options to be passed to constructor
    // - `callback` {Function} callback to call once acquired.
    me.acquire = function(options, callback) {

        var id = this.makeId(options);
        if (!this.pools[id]) {
            this.pools[id] = this.makePool(id, options);
        }
        this.pools[id].acquire(function(err, resource) {
            callback(err, resource);
        });
    };

    // Release resource.
    //
    // - `options`  {Object} options passed to original constructor
    // - `resource` {Object} resource object to release
    me.release = function(options, resource) {
        var id = this.makeId(options);
        this.pools[id] && this.pools[id].release(resource);
    };

    // Reset all mappools that match the general key
    //
    // - `options` {Array} identifiers used to build up the key of the map pool to reset.
    //                    just needs layer_id and user_id
    me.reset = function(options, callback){
        // var id = this.makeId(options);
        // var key_base = options.user_id + ":" + options.layer_id + ".*"
        // var reggers = new RegExp(key_base)
        // var that = this;
        //
        // Step(
        //   function(){
        //     return _.select(_.keys(that.pools), function(key){ return reggers.test(key); });
        //   },
        //   function(err, matches){
        //     var group = this.group();
        //     _.each(matches, function(style_key) {
        //       that.pools[style_key].destroyAllNow(group());
        //     });
        //   },
        //   function(err, data){
        //     if (err) throw err;
        //     callback();
        //   }
        // );
    };

    // Factory for pool objects.
    me.makePool = function(id, opts) {
        return Pool({
            name: id,
            opts: opts,
            create: function(callback) {
                var that = this;
                //var builder_ops = {datasource:{srid:4326, geometry_field: "the_geom", extent:"-179,-89,179,89"}}
//        , builder_ops
                var mml_builder = mml_store.mml_builder(this.opts);

                Step(
                    function generateXML(){
                        mml_builder.toXML(this);
                    },
                    function loadMapnik(err, data){
                        if (err) throw err;
                        //console.log(data);

                        var uri = {
                            query: { base: that.name },
                            protocol: 'mapnik:',
                            slashes: true,
                            xml: data,
                            mml: {
                                interactivity: {
                                    layer: that.opts.table,
                                    fields: ['cartodb_id']
                                },
                                format: that.opts.format
                            }
                        };

                        //console.log(uri);
                        tilelive.load(uri, this);
                    },
                    function returnCallback(err, source){
                        callback(err, source);
                    }
                );
            },
            destroy: function(resource) {
                resource._pool.destroyAllNow();
                delete resource;
            },
            max: 10,
            idleTimeoutMillis: 10000,//60000,　//100 in dev
            reapIntervalMillis: 1000, //1000, //10 in dev
            log: false
        });
    };

    return me;
}

module.exports = MapPool;