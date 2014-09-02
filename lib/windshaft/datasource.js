var fs       = require('fs')
    , path     = require('path')
    , util     = require('util')
    , _        = require('underscore')
    , request  = require('request')
    , zlib     = require('zlib')
    , tilelive = require('tilelive')
    , mapnik   = require('mapnik')
    , PSQL     = require('cartodb-psql')
    , Step     = require('step')
    , varint   = require('varint')
    ;

function StaticVectorTileSource(uri, cb) {
    var cfg = uri.mapcfg;

    var layers = [];
    for ( var i=0; i<cfg.layers.length; ++i ) {
        var lyr = cfg.layers[i];
        var lyrname = lyr.options.sql;
        layers.push(lyrname);
    }
    layers = layers.join(',');

    var ds = uri.datasource;
    console.log("layers: " + layers);
    var tilestpl = ds.tiles.replace('{layers}', layers);
    console.log("tilesurl: " + tilestpl);

    this.datasource = ds;
    this.tilestpl = tilestpl;
    this.uri = uri;
    this.info = {
        /*
         minzoom: 0,
         maxzoom: 40,
         maskLevel: 0, // ??
         */
    };
    cb(null, this);
}

StaticVectorTileSource.prototype.getFile = function(uri, callback) {
    if ( uri.match('file://') ) {
        uri = uri.substr(7);
        var file = fs.readFileSync(uri);
        callback(null, file);
        return;
    }
    request({
        uri:uri,
        encoding:null
    }, function (err, res, file) {
        if ( err ) callback(err);
        else if ( res.statusCode != 200 ) {
            callback(new Error(res.statusCode + ': ' + file));
        } else {
            //DEBUG
            //var outpath = '/tmp/' + uri.replace(/\//g, '.') + '.pbf';
            //fs.writeFileSync(outpath, file, 'binary');
            //console.log("Tile saved to " + outpath);
            callback(null, file);
        }
    })
};
StaticVectorTileSource.prototype.getTile = function(z,x,y,callback) {
    console.log("getTile called with z:" + z + ',x:' + x + ',y:' + y );
    var uri = this.tilestpl.replace('{z}', z).replace('{x}',x).replace('{y}',y);
    console.log("URI: " + uri);

    this.getFile(uri, function(err, tilefile) {
        if ( err ) { callback(err); return; }
        if ( tilefile[0] == 0x1A ) {
            // See https://github.com/mapbox/tilelive-vector/issues/71
            //console.log("TILE IS NOT COMPRESSED!")
            zlib.deflate(tilefile, function(err, data) {
                callback(err, data);
            });
            return;
        }
        callback(null, tilefile);
    });
};
StaticVectorTileSource.prototype.getInfo = function(callback) {
    //console.log("getInfo called with args: "); console.dir(arguments);
    callback(null, this.info);
};


//-------------------------------------------------------------

var tile_size = 256;
var tile_max_geosize = 40075017; // earth circumference in webmercator 3857

function CDB_XYZ_Resolution(z) {
    var full_resolution = tile_max_geosize / tile_size;
    return full_resolution / Math.pow(2, z);
}

function CDB_XYZ_Extent(x, y, z) {
    var initial_resolution = CDB_XYZ_Resolution(0);
    var origin_shift = (initial_resolution * tile_size) / 2.0;

    var pixres = initial_resolution / Math.pow(2,z);
    var tile_geo_size = tile_size * pixres;

    var xmin = -origin_shift + x*tile_geo_size;
    var xmax = -origin_shift + (x+1)*tile_geo_size;

    var ymin = -origin_shift + y*tile_geo_size;
    var ymax = -origin_shift + (y+1)*tile_geo_size;
    return {
        xmin: xmin, ymin: ymin, xmax: xmax, ymax: ymax
    };
}

function PgsqlVectorTileSource(uri, cb) {

    this.uri = uri;
    this._psql = new PSQL(uri.dbParams);

    // TODO:
    //  For each layer, construct the query that returns
    //  a VectorTile.Layer for it
    var cfg = this.uri.mapcfg;
    var layers = cfg.layers;

    this.queries = [];

    var that = this;
    prepNext = function(lyrnum) {
        if ( lyrnum == cfg.layers.length ) {
            that.info = {
                /*
                 minzoom: 0,
                 maxzoom: 40,
                 maskLevel: 0, // ??
                 */
            };
            cb(null, that);
            return;
        }
        var lyr = layers[lyrnum];
        //console.log("layer: " + util.inspect(lyr,false,10));

        var lyrname = 'layer' + lyrnum;
        var gname = lyr.options.geom_column || 'the_geom';
        var idname = 'NULL'; // TODO: find it out, I guess ?
        var sql = lyr.options.sql;
        var layer_sql = "select CDB_AsVectorTile_Layer(" +
            "CDB_MakeEmptyVectorTile_Layer(1,'" + lyrname +
            "',{ipx},{ipy},{sfx},{sfy},0,1), " +
            gname + ',' + idname + ',NULL,NULL,NULL) o from ( ' +
            'SELECT ST_Transform("' + gname + '", 3857) as ' + gname
            + ' FROM ( ' + sql + ') _wstrans WHERE "' + gname +
            '" && {bbox}) _wsvds';
        that.queries.push(layer_sql);

        prepNext(lyrnum+1);
    };
    prepNext(0);

}

PgsqlVectorTileSource.prototype.getInfo = function(callback) {
    //console.log("getInfo called with args: "); console.dir(arguments);
    callback(null, this.info);
};
PgsqlVectorTileSource.prototype.getTile = function(z,x,y,callback) {
    console.log("getTile called with z:" + z + ',x:' + x + ',y:' + y );

    var ext = CDB_XYZ_Extent(x,y,z);
    var ipx = ext.xmin;
    var ipy = ext.ymin;
    var sfx = CDB_XYZ_Resolution(z) / 16; // for the default 4096 layer extent
    var sfy = sfx;

    console.log("ipx: " + ipx);
    console.log("ipy: " + ipy);
    console.log("sfx: " + sfx);
    console.log("sfy: " + sfy);

    //  For each layer, construct a VectorTile
    //  Merge all VectorTiles togeter, return the tile
    var that = this;
    var tiles = [];
    fetchNext = function(lyrnum) {
        if ( lyrnum == that.queries.length ) {
            var vtile = new mapnik.VectorTile(z, x, y);
            //console.log(tiles.length + ' vtiles to composite');
            if ( tiles.length ) {
                vtile.composite(tiles);
            }
            //console.log('composite tile names: ' + vtile.names());
            //console.log('composite tile hex: ' + vtile.getData().toString('hex'));
            vtile.parse(function(err) {
                if ( err ) { callback(err); return; }
                /* //DEBUG
                 _.each(vtile.names(), function(n) {
                 console.log(n + ': ' + util.inspect(vtile.toGeoJSON(n), false, 10));
                 }); */
                var headers;
                if ( that.uri.format == 'pbf' ) {
                    headers = {
                        'content-type': 'application/x-protobuf'
                    };
                    vtile = vtile.getData();
                }
//console.log("Vtile type is " + typeof(vtile));
                callback(null, vtile, headers);
            });
            return;
        }
        var sql = that.queries[lyrnum]
                .replace('{ipx}', ipx)
                .replace('{ipy}', ipy)
                .replace('{sfx}', sfx)
                .replace('{sfy}', sfy)
                .replace('{bbox}', 'ST_MakeEnvelope(' + ext.xmin + ','
                    + ext.ymin + ','
                    + ext.xmax + ','
                    + ext.ymax + ','
                    + '3857)')
            ;
        console.log("Q: " + sql);
        that._psql.query(sql, function(err, data) {
            if ( err ) {
                callback(err);
                return;
            }
            var encoded = data.rows[0].o;
            if ( ! encoded ) {
                // empty layer here
                fetchNext(lyrnum+1);
                return;
            }
            //console.log("D (" + typeof(encoded) + "): " + encoded.toString('hex')); //util.inspect(data));
            // Need to prefix with a tag and length to make a full tile
            var tile = new mapnik.VectorTile(z, x, y);
            var len = encoded.length;
            //var wrapped = new Buffer();
            var enclen = new Buffer(varint.encode(len));
            var buffers = [];
            var b = new Buffer(1);
            b[0] = 0x1A;
            buffers.push(b);
            buffers.push(enclen);
            buffers.push(encoded);
            var wrapped = Buffer.concat(buffers);
            //console.log("W: " + wrapped.toString('hex'));

            tile._srcbytes = wrapped.length;
            tile.setData(wrapped);
            tile.parse(function(err) {
                if ( err ) {
                    callback(err);
                    return;
                }
                //console.log('single tile names: ' + tile.names());
                //console.log('GeoJSON: ' + util.inspect(tile.toGeoJSON(0), false, 10));
                tiles.push(tile);
                fetchNext(lyrnum+1);
            });
        }, true /* readonly */);
    };
    fetchNext(0);


};

//-------------------------------------------------------------

function Datasource(uri, cb) {
    //console.log("ctor called with uri: " + util.inspect(uri,false,10));
    if ( ! uri.mapcfg ) {
        cb(new Error("Missing mapconfig in Datasource constructor"));
        return;
    }
    var dsname = uri.mapcfg.datasource;
    if ( ! dsname ) {
        cb(new Error("MVT Datasource initialization requires a datasource name in mapconfig"));
        return;
    }

    if ( ! datasources ) {
        cb(new Error("Cannot construct Datasource with no configured datasources"));
        return;
    }

    var ds = datasources[dsname];
    if ( ! ds ) {
        cb(new Error("Unknown datasource name '" + dsname + "'"));
        return;
    }
    //console.log("datasource: " + util.inspect(ds));

    var source;
    if ( ds.tiles ) {
        new StaticVectorTileSource(uri, cb);
    }
    else if ( ds.postgres ) {
        new PgsqlVectorTileSource(uri, cb);
    }
    else {
        cb(new Error("Unknown datasource type"));
    }
}


function DatasourceFactory(ds)
{
    /*
     if ( ! ds ) {
     throw new Error("DatasourceFactory needs datasources");
     }
     */
    // NOTE: 'datasources' is module-static
    datasources = ds;
}


DatasourceFactory.prototype.getHandler = function () {
    return Datasource;
};

DatasourceFactory.prototype.loadURI = function(cfg, dbParams, uri, callback) {
    var dsname = cfg.datasource;
    if ( ! dsname ) {
        tilelive.load(uri, callback);
        return;
    }
    if ( ! datasources ) {
        callback(new Error("Cannot call DatasourceFactory.loadURI with no configured datasources"));
        return;
    }
    var ds = datasources[dsname];
    if ( ! ds ) {
        callback(new Error("Unknown datasource '" + dsname + "'"));
        return;
    }

    var type = ds.type || 'static';
    if ( ds.tiles ) {
        // rename layers to their vector datasource layer name
        for ( var i=0; i<cfg.layers.length; ++i ) {
            var lyr = cfg.layers[i];
            var lyrname = lyr.options.sql;
            var pat = new RegExp("layer"+i, 'g');
            uri.xml = uri.xml.replace(pat, lyrname);
        }
    }

    uri.source = {
        protocol: 'windshaft:',
        datasource: ds,
        dbParams: dbParams,
        mapcfg: cfg
    };

    // strip Datasource tags, there's a single one now
    uri.xml = uri.xml.replace(/\<Datasource\>[\s\S]*?\<\/Datasource\>/g, '');

    // VectorTile tiles are always in epsg:3857
    // TODO: make it safer, change grainstore configuration
    //       prior to get here ?
    uri.xml = uri.xml.replace(/epsg:4326/g, 'epsg:3857');

    console.log("XML: " + util.inspect(uri.xml));

    uri.protocol = 'vector:';

    // hand off to tilelive to create a renderer
    tilelive.load(uri, callback);
};

module.exports = DatasourceFactory;