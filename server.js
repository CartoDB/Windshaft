var express    = require('express')
  , grainstore = require('grainstore')
  , _          = require('underscore')
  , MapPool    = require('lib/windshaft/map_pool.js')
  , Step       = require('step');

var windshaft = function(){

  var mml_store  = new grainstore.MMLStore(global.environment.redis);
  var map_pool   = new MapPool(mml_store);
  var app = express.createServer();
      app.use(express.bodyParser());
      app.use(express.logger({buffer:true,
                              format:'[:remote-addr :date] \033[90m:method\033[0m \033[36m:url\033[0m \033[90m:status :response-time ms -> :res[Content-Type]\033[0m'}));

  var source;

    app.get('/', function(req, res){
      res.send('Hello World');
  });

  // optional arguments in the query string are:
  // `sql`
  // `geom_type`
  // `cache_buster`
  app.get('/tiles/db/:dbname/table/:table/:z/:x/:y.*', function(req, res){

    // Whitelist input
    var good_query = ['sql', 'geom_type', 'cache_buster'];
    var bad_query  = _.difference(_.keys(req.query), good_query);
    _.each(bad_query, function(key){ delete req.query[key]; });
    var params = _.extend(req.query, req.params);
    params.format = req.params[0]


    Step(
      function() {
          if (_.isUndefined(source)){
            map_pool.acquire(params, this);
          } else {
              return source;
          }
      },
      function(err, res) {
        if (err) throw err;
        if (_.isUndefined(source)) source = res;
        var my_func = (params[0] === 'grid.json') ? 'getGrid' : 'getTile';
        source[my_func].call(source, params.z, params.x, params.y, this);
       },
       function(err, tile, headers) {
         //map_pool.release(params, source);
         if (err){
           console.log("Tile render error:\n" + err);
           res.send(err, 500);
         } else {
           res.send(tile, headers, 200);
         }
       }
    );
  });

  app.get('/tiles/db/:dbname/table/:table/style', function(req, res){
    var mml_builder = mml_store.mml_builder(_.extend(req.query, req.params));

    mml_builder.getStyle(function(err,data){
      if (err){
        res.send(err, 500);
      } else {
        res.send({style: data.style}, 200);
      }
    });
  });

  app.post('/tiles/db/:dbname/table/:table/style', function(req, res){
    var mml_builder = mml_store.mml_builder(_.extend(req.query, req.params));

    if (_.isUndefined(req.body) || _.isUndefined(req.body.style)) {
      res.send({error: 'must sent style information'}, 400);
    } else {

      mml_builder.setStyle(req.body.style, function(err,data){
        if (err){
          res.send(err.message.split('\n'), 400);
        } else {
          res.send(200);
        }
      });
    }
  });

  //add reset pool url for when edits happen?


  return app;
}();





module.exports = windshaft    
  