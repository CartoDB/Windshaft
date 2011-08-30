var   _          = require('underscore')
    , Step       = require('step')
    , cartoData  = require('./carto_data');

module.exports = function(){
    var me = {
        base_url: '/tiles/:table'
    };

    /**
     * get database name & default geometry type from subdomain/user metadata held in CartoDB Redis
     * @param req - standard express request obj. Should have host & table
     * @param callback
     */
    me.req2params = function(req, callback){
        _.extend(req.params, req.query);

        Step(
            function getDatabase(){
                cartoData.getDatabase(req, this);
            },
            function getGeometryType(err, data){
                if (err) throw err;
                _.extend(req.params, {dbname:data});

                cartoData.getGeometryType(req, this);
            },
            function finishSetup(err, data){
                if (err) throw err;
                _.extend(req.params, {geom_type: data});

                callback(err, req);
            }
        );
    };

    return me;
}();