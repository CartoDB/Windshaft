var   express     = require('express')
    , grainstore  = require('grainstore')
    , RenderCache = require('./render_cache')
    , _           = require('underscore')
    , Step        = require('step');

module.exports = function(opts){
    var opts = opts || {};


    // initialize express server
    var app = express.createServer();
    app.enable('jsonp callback');
    app.use(express.bodyParser());
    app.use(express.logger({buffer:true,
        format:'[:remote-addr :date] \033[90m:method\033[0m \033[36m:url\033[0m \033[90m:status :response-time ms -> :res[Content-Type]\033[0m'}));


    // initialize core mml_store
    var mml_store  = new grainstore.MMLStore(global.environment.redis);


    // take in base url and base req2params from opts or throw exception
    if (!_.isString(opts.base_url) || !_.isFunction(opts.req2params)) throw new Error("Must initialise Windshaft with a base URL and req2params function");
    _.extend(app, opts);

    // canary route
    app.get('/', function(req, res){
        res.send('Hello World');
    });

    // Get Map Style
    // can specify a jsonp callback
    app.get(app.base_url + '/style', function(req, res){
        var mml_builder;

        Step(
            function(){
                app.req2params(req, this);
            },
            function(err, data){
                if (err) throw err;

                mml_builder = mml_store.mml_builder(req.params);
                mml_builder.getStyle(this);
            },
            function(err, data){
                if (err){
                    res.send(err, 500);
                } else {
                    res.send({style: data.style}, 200);
                }
            }
        );
    });

    // Set Map Style
    app.post(app.base_url + '/style', function(req, res){
        var mml_builder;

        Step(
            function(){
                app.req2params(req, this);
            },
            function(err, data){
                if (err) throw err;
                if (_.isUndefined(req.body) || _.isUndefined(req.body.style)) {
                    res.send({error: 'must sent style information'}, 400);
                } else {
                    mml_builder = mml_store.mml_builder(req.params);
                    mml_builder.setStyle(req.body.style, this);
                }
            },
            function(err, data){
                if (err){
                    res.send(err.message.split('\n'), 400);
                } else {
                    res.send(200);
                }
            }
        );
    });

    /**
     * Helper to allow access to the layour to be used in the maps infowindow popup.
     * possibly should be refactored, and may not belong on windshaft.
     * can specify a jsonp callback
     */
    app.get(app.base_url + '/infowindow', function(req, res){
        Step(
            function(){
                app.getInfowindow(req, this);
            },
            function(err, data){
                if (err){
                    res.send(err.message, 400);
                } else {
                    res.send({infowindow: data}, 200);
                }
            }
        );
    });

    // Tile render.
    // query string args are:
    // `sql`
    // `geom_type`
    // `cache_buster`
    app.get(app.base_url + '/:z/:x/:y.*', function(req, res){
        Step(
            function(){
                app.req2params(req, this);
            },
            function(){
                RenderCache.getRenderer(req, this);
            },
            function(err, renderer) {
                if (err) throw err;
                var my_func = (req.params.format === 'grid.json') ? 'getGrid' : 'getTile';
                renderer[my_func].call(renderer, req.params.z, req.params.x, req.params.y, this);
            },
            function(err, tile, headers) {
                if (err){
                    console.log("Tile render error:\n" + err);
                    res.send(err, 500);
                } else {
                    res.send(tile, headers, 200);
                }
            }
        );
    });

    // build up fun evented renderer woo
    // add reset renderer link

    return app;
};
