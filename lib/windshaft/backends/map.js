var Step = require('step');
var PSQL = require('cartodb-psql');
var _ = require('underscore');


function MapBackend(app, renderCache, mapStore) {
    this._app = app;
    this._renderCache = renderCache;
    this._mapStore = mapStore;
}

module.exports = MapBackend;


// Gets a tile for a given set of tile ZXY coords. (OSM style)
// Call with .png for images, or .grid.json for UTFGrid tiles
//
// query string arguments:
//
// * sql - use SQL to filter displayed results or perform operations pre-render
// * style - assign a per tile style using carto
// * interactivity - specify which columns to represent in the UTFGrid
// * cache_buster - specify to ensure a new renderer is used
// * geom_type - specify default style to use if no style present
//
// Triggers beforeTileRender and afterTileRender render filters
//
MapBackend.prototype.getTileOrGrid = function(req, res, callback){

    var self = this;

    req.profiler.start('getTileOrGrid');

    var renderer;

    Step(
        function() {
            self._app.beforeTileRender(req, res, this);
        },
        function(err){
            req.profiler.done('beforeTileRender');
            if (err) throw err;
            if (req.params.format === 'grid.json' && !req.params.interactivity) {
                if ( ! req.params.token ) { // token embeds interactivity
                    throw new Error("Missing interactivity parameter");
                }
            }
            self._renderCache.getRenderer(req, this);

        },
        function(err, r, is_cached) {
            req.profiler.done('getRenderer');
            renderer = r;
            if ( is_cached ) {
                res.header('X-Windshaft-Cache', Date.now() - renderer.ctime);
            }
            if (err) throw err;
            renderer.getTile(+req.params.z, +req.params.x, +req.params.y, this);
        },
        function(err, tile, headers) {
            req.profiler.done('render-'+req.params.format.replace('.','-'));
            if (err) throw err;
            self._app.afterTileRender(req, res, tile, headers || {}, this);
        },
        function(err, tile, headers) {
            req.profiler.done('afterTileRender');
            if ( renderer ) {
                renderer.release();
                req.profiler.done('renderer_release');
            }
            // this should end getTileOrGrid profile task
            req.profiler.end();
            callback(err, req, res, tile, headers);
        }
    );
};

/// Gets attributes for a given layer feature
//
/// Calls req2params, then expects parameters:
///
/// * token - MapConfig identifier
/// * layer - Layer number
/// * fid   - Feature identifier
///
/// The referenced layer must have been configured
/// to allow for attributes fetching.
/// See https://github.com/CartoDB/Windshaft/wiki/MapConfig-1.1.0
///
/// @param testMode if true generates a call returning requested
///                 columns plus the fid column of the first record
///                 it is only meant to check validity of configuration
///
MapBackend.prototype.getFeatureAttributes = function(req, res, testMode) {
    var self = this;

    var mapConfig;
    var params;
    Step(
        function (){
            self._app.req2params(req, this);
        },
        function getMapConfig(err) {
            req.profiler.done('req2params');
            if (err) throw err;
            params = req.params;
            self._mapStore.load(params.token, this);
        },
        function getPGClient(err, data) {
            if (err) throw err;

            req.profiler.done('MapStore.load');
            mapConfig = data;

            var dbParams = self._renderCache.dbParamsFromReqParams(params);
            return new PSQL(dbParams);
        },
        function getAttributes(err, pg) {
            if (err) throw err;

            var layer = mapConfig.getLayer(params.layer);
            if ( ! layer ) {
                throw new Error("Map " + params.token +
                    " has no layer number " + params.layer);
            }
            var attributes = layer.options.attributes;
            if ( ! attributes ) {
                throw new Error("Layer " + params.layer +
                    " has no exposed attributes");
            }

            // NOTE: we're assuming that the presence of "attributes"
            //       means it is well-formed (should be checked at
            //       MapConfig construction/validation time).

            var fid_col = attributes.id;
            var att_cols = attributes.columns;

            // prepare columns with double quotes
            var quoted_att_cols = _.map(att_cols, function(n) {
                return pg.quoteIdentifier(n);
            }).join(',');

            if ( testMode )
                quoted_att_cols += ',' + pg.quoteIdentifier(fid_col);

            var sql = 'select ' + quoted_att_cols +
                ' from ( ' + layer.options.sql + ' ) as _windshaft_subquery ';
            if ( ! testMode ) sql +=
                ' WHERE ' + pg.quoteIdentifier(fid_col) + ' = ' + params.fid;
            else sql += ' LIMIT 1';

            // console.log("SQL:  " + sql);

            pg.query(sql, this, true); // use read-only transaction
        },
        function formatAttributes(err, data) {
            req.profiler.done('getAttributes');
            if (err) throw err;
            if ( data.rows.length != 1 ) {
                if ( testMode ) return null;
                else {
                    var rowsLengthError = new Error(data.rows.length +
                        " features in layer " + params.layer +
                        " of map " + params.token +
                        " are identified by fid " + params.fid);
                    if ( ! data.rows.length ) rowsLengthError.http_status = 404;
                    throw rowsLengthError;
                }
            }
            return data.rows[0];
        },
        function(err, tile) {
            req.profiler.done('formatAttributes');
            if (err){
                // See https://github.com/Vizzuality/Windshaft-cartodb/issues/68
                var errMsg = err.message ? ( '' + err.message ) : ( '' + err );
                var statusCode = self._app.findStatusCode(err);
                self._app.sendError(res, {error: errMsg}, statusCode, 'GET ATTRIBUTES', err);
            } else {
                self._app.sendWithHeaders(res, tile, 200, {});
            }
        }
    );
};
