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
        timeouts:{},
        timeout: timeout || 60000
    };


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


    // Acquire preconfigured mapnik resource either from pool or fresh.
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

        if (!this.renderers[key]){
            // if there are no existing renderers:
            // 1. create a renderer
            // 2. store it in the render cache array
            // 3. register a timeout to remove renderer from cache after a period of time
            // 4. pass renderer on to callback
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
            // if there is an existing renderer
            // 1. delete old render cache timeout
            // 2. make a new timeout for the renderer
            // 3. send the renderer out for use
            clearTimeout(this.timeouts[key]);
            that.timeouts[key] = setTimeout(that.del.bind(that, key), that.timeout);

            callback(null, this.renderers[key]);
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

                // metatile:1 == off. if we can purge renderers, we can turn metatiling back on here for a speedup
                // bufferSize:64. Means that the tiler includes a 64px buffer around each tile in the render.
                //                This is important for labels and other marker that overlap tile boundaries.
                //                Setting to 128 ensures no render artifacts. 64 may have artifacts but is faster.
                //                Less important if we can turn metatiling on.
                // TODO: Remove  + new Date().getTime() from base key. It's a hack to ensure styles are updated
                var query = { base: that.createKey(params) + new Date().getTime(),
                              metatile:1,
                              bufferSize:64 };


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
        this.renderers[id]._pool.destroyAllNow();
        delete this.renderers[id];
        if (this.timeouts[id]) {
            clearTimeout(this.timeouts[id]);
            delete this.timeouts[id];
        }
    };


    return me;
};
