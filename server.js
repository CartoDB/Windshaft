var express    = require('express')
  , grainstore = require('grainstore')
  , _          = require('underscore')
  , mapnik     = require('tilelive-mapnik');

var windshaft = function(){
  
  var mml_store  = new grainstore.MMLStore(global.environment.redis);  
  var app = express.createServer();
      app.use(express.bodyParser());
      app.use(express.logger());
      
  app.get('/', function(req, res){
      res.send('Hello World');
  });


  app.get('/tiles/db/:db_name/table/:table_name/:z/:x/:y/.*', function(req, res){  
    var mml_builder = mml_store.mml_builder(_.extend(req.query, req.params)); //don't do this.
    
    mml_builder.toXML(function(err,data){
      if (err){
        res.send(err, 500);
      } else {        
        var uri = {
            protocol: 'mapnik:',
            slashes: true,
            xml: data,
            mml: {
                interactivity: {
                    layer: req.params.table_name,
                    fields: ['cartodb_id']
                },
                format: req.params[0]
            }
        };              
        
        new mapnik(uri, function(err, source) {
            if (err) throw err;
            
            var my_func = (req.params[0] === 'grid.json') ? 'getGrid' : 'getTile';
            source.myFunc = source[my_func];  
            source.myFunc(req.params.z, req.params.x, req.params.y, function(err, tile, headers) {
              if (err){
                res.send(err, 500);
              } else {       
                res.send(tile, headers, 200);                
              }
            });                            
        });
      }      
    });
  });

  app.get('/tiles/db/:db_name/table/:table_name/style', function(req, res){  
    var mml_builder = mml_store.mml_builder(_.extend(req.query, req.params));
    
    mml_builder.getStyle(function(err,data){
      if (err){
        res.send(err, 500);
      } else {
        res.send({style: data.style}, 200);
      }      
    });
  });
  
  app.post('/tiles/db/:db_name/table/:table_name/style', function(req, res){  
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
  
  
  
  return app;  
}();
  



  
module.exports = windshaft    
  