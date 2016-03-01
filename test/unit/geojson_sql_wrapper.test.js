require('../support/test_helper');

var assert = require('assert');
var expectedQuery =
"SELECT\n" +
"  row_to_json(featurecollection) as geojson\n" +
"FROM (\n" +
"  SELECT\n" +
"    'FeatureCollection' AS TYPE,\n" +
"    array_to_json(\n" +
"      array_agg(feature)\n" +
"    ) AS features\n" +
"  FROM (\n" +
"    SELECT\n" +
"      'Feature' AS TYPE,\n" +
"      st_asgeojson(\n" +
"        \n" +
"        st_clipbybox2d(\n" +
"        \n" +
"          st_simplify(\n" +
"            st_makevalid(tbl.the_geom_webmercator),\n" +
"            cdb_xyz_resolution(1) * (1.0 / 20.0),\n" +
"            true\n" +
"          ),\n" +
"          st_expand(\n" +
"            cdb_xyz_extent(1, 1, 1),\n" +
"            cdb_xyz_resolution(1) * undefined\n" +
"          )\n" +
"        )\n" +
"      )::json AS geometry,\n" +
"      \n" +
"      '{}'::json\n" +
"      \n" +
"      AS properties\n" +
"    FROM\n" +
"      (select * from test_table) AS tbl\n" +
"    WHERE (\n" +
"      the_geom_webmercator\n" +
"      &&\n" +
"      st_expand(\n" +
"        cdb_xyz_extent(1, 1, 1),\n" +
"        cdb_xyz_resolution(1) * undefined\n" +
"      )\n" +
"    )\n" +
"  ) AS feature\n" +
") AS featurecollection;\n";

describe('Geojson sql wrapper', function() {
    var GeojsonSqlWrapper = require('../../lib/windshaft/renderers/mapnik/geojson_sql_wrapper.js');

    beforeEach(function () {
        this.geojsonSqlWrapper = new GeojsonSqlWrapper();
    });

    it('.wrap should return a query well formed', function() {
        var query = this.geojsonSqlWrapper.wrap({
            layerSql: 'select * from test_table',
            geomColumn: 'the_geom_webmercator',
            coord: {
                x: 1,
                y: 1
            },
            zoom: 1,
            columns: null,
            clipByBox2d: true
        });
        assert.equal(query, expectedQuery);
    });

    it('.wrap should throw an error if context argument is not valid', function() {
        assert.throws(function () {
            this.geojsonSqlWrapper.wrap({
                irrelevant: 'irrelevant'
            });
        }.bind(this),
        TypeError);
    });
});
