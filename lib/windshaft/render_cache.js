// caches render objects and purges them after 60 seconds of inactivity
// also has functions to purge all.

var Step = require('step')
    , _ = require('underscore')
    , grainstore = require('grainstore')
    , tilelive   = require('tilelive');

require('tilelive-mapnik').registerProtocols(tilelive);


module.exports = function(timeout, mml_store){

    var renderKey = "<%= dbname %>:<%= table %>:<%= format %>:<%= geom_type %>:<%= sql %>:<%= interactivity %>:<%= cache_buster %>";
    var baseKey   = "<%= dbname %>:<%= table %>:";

    var me = {
        renderers: {},
        timeouts:{},
        timeout: timeout || 60000
    };


    // Create a string ID from a datasource.
    me.createKey = function(params) {
        var opts =  _.clone(params); // as params is a weird arrayobj right here
        delete opts.x;
        delete opts.y;
        delete opts.z;
        delete opts.callback;
        _.defaults(opts, {dbname:'', table:'', format:'', geom_type:'', sql:'', interactivity:'', cache_buster: ''});

        return _.template(renderKey, opts);
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


    // if renderer exists at key, return it, else generate a new one and save at key
    me.getRenderer = function(req, callback){
        var key = this.createKey(req.params);
        var that = this;

        if (!this.renderers[key]){
            Step(
                function(){
                    that.makeRenderer(req.params, this);
                },
                function(err, data){
                    if (err) throw err;
                    // only cache the first. throw the rest away
                    // TODO Check that the GC properly garbage collects these single use renderers
                    if (!that.renderers[key])
                        that.renderers[key] = data;

                    if (!that.timeouts[key])
                        that.timeouts[key]  = setTimeout(that.del.bind(that, key), that.timeout);

                    callback(err, data);
                },
                function handleError(err, data){
                    callback(err,data);
                }
            );
        } else {
            // reset cache timeout
            clearTimeout(this.timeouts[key]);
            that.timeouts[key] = setTimeout(that.del.bind(that, key), that.timeout);

            callback(null, this.renderers[key]);
        }
    };

    me.makeRenderer = function(params, callback){
        var that = this;

        // TODO: Allow mml_builder to be configured here        
        var mml_builder = mml_store.mml_builder(params);

        Step(
            function generateXML(){
                mml_builder.toXML(this);
            },
            function loadMapnik(err, data){
                if (err) throw err;

                var uri = {
                    query: { base: that.createKey(params) },
                    protocol: 'mapnik:',
                    slashes: true,
                    xml: data,
                    mml: {
                        interactivity: {
                            layer: params.table,
                            fields: [(params.interactivity) ? params.interactivity : null]
                        },
                        format: params.format
                    }
                };

                tilelive.load(uri, this);
            },
            function returnCallback(err, source){
                callback(err, source);
            }
        );
    };

    me.purge = function(){
        var that = this;
        _.each(_.keys(that.renderers), function(key){
            that.del(key);
        });
    };


    // Clears out all renderers related to a given table, regardless of other arguments
    // TODO: Make less blocking
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
        this.renderers[id]._pool.destroyAllNow();
        delete this.renderers[id];
        if (this.timeouts[id]) {
            clearTimeout(this.timeouts[id]);
            delete this.timeouts[id];
        }
    };


    return me;
};