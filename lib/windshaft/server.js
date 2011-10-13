var   express     = require('express')
    , grainstore  = require('grainstore')
    , RenderCache = require('./render_cache')
    , _           = require('underscore')
    , Step        = require('step')

module.exports = function(opts){
    var opts = opts || {};

    // initialize core mml_store
    var mml_store  = new grainstore.MMLStore(opts.redis, opts.grainstore);

    // initialize render cache 60 seconds TTL
    var render_cache = new RenderCache(60000, mml_store);

    // initialize express server
    var app = express.createServer();
    app.enable('jsonp callback');
    app.use(express.bodyParser());
    app.use(express.logger({buffer:true,
        format:'[:remote-addr :date] \033[90m:method\033[0m \033[36m:url\033[0m \033[90m:status :response-time ms -> :res[Content-Type]\033[0m'}));

    //TODO: extrac server config to a function
    // take in base url and base req2params from opts or throw exception
    if (!_.isString(opts.base_url) || !_.isFunction(opts.req2params)) throw new Error("Must initialise Windshaft with a base URL and req2params function");
    _.extend(app, opts);

    // set detault beforeTileRender and afterTileRender filters
    _.defaults(app, {
        beforeTileRender: function(req, res, callback) {
            callback(null);
        },
        afterTileRender: function(req, res, tile, headers, callback) {
            callback(null, tile, headers);
        },
        afterStateChange: function(req, data, callback) {
            callback(null, data);
        }
    })

    // canary route
    app.get('/', function(req, res){
       res.send("JOHN RAMBO");
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
                    res.send({error: 'must send style information'}, 400);
                } else {
                    mml_builder = mml_store.mml_builder(req.params);
                    mml_builder.setStyle(req.body.style, this);
                }
            },
            function(err, data) {
                if (err) throw err;
                var param = req.params;
                app.afterStateChange(req, data, this);
            },
            function(err, data){
                if (err){
                    res.send(err.message.split('\n'), 400);
                } else {
                    render_cache.reset(req);
                    res.send(200);
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

        // Enable CORS access by web browsers if set in settings
        if(opts.enable_cors){
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "X-Requested-With");
        }

        // strip format from end of url and attach to params
        req.params.format = req.params['0'];
        delete req.params['0'];

        // Wrap SQL requests in mapnik format if sent
        if(req.query.sql && req.query.sql !== '') {
            req.query.sql = "(" + req.query.sql + ") as cdbq"
        }

        Step(
            function(){
                app.req2params(req, this);
            },
            function(err) {
                if (err) throw err;
                app.beforeTileRender(req, res, this);
            },
            function(err, data){
                if (err) throw err;
                render_cache.getRenderer(req, this);
            },
            function(err, renderer) {
                if (err) throw err;
                var my_func = (req.params.format === 'grid.json') ? 'getGrid' : 'getTile';
                renderer[my_func].call(renderer, req.params.z, req.params.x, req.params.y, this);
            },
            function(err, tile, headers) {
                if (err) throw err;
                app.afterTileRender(req, res, tile, headers, this);
            },
            function(err, tile, headers) {
                if (err){
                    console.log("[TILE RENDER ERROR]\n" + err);
                    res.send(err, 500);
                } else {
                    res.send(tile, headers, 200);
                }
            }
        );
    });


    return app;
};
