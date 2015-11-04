var format = require('../../utils/format');

/**
 Definition
 {
     "type”: "bbox",
     "options": {
        "column": "the_geom_webmercator",
        "srid": 3857
     }
 }

 Params
 {
     “bbox”: "west,south,east,north"
 }
 */
function BBox(filterDefinition, filterParams) {
    var bbox = filterParams.bbox;

    if (!bbox) {
        throw new Error('BBox filter expects to have a bbox param');
    }

    var bboxElements = bbox.split(',');

    var isNumericBbox = bboxElements
        .map(function(e) { return Number.isFinite(+e); })
        .reduce(function(allFinite, isFinite) {
            if (!allFinite) {
                return false;
            }
            return isFinite;
        }, true);

    if (bboxElements.length !== 4 || !isNumericBbox) {
        throw new Error('Invalid bbox filter, expected format="west,south,east,north"');
    }

    this.column = filterDefinition.column || 'the_geom_webmercator';
    this.srid = filterDefinition.srid || 3857;
    this.bbox = filterParams.bbox;
}

module.exports = BBox;

BBox.prototype.sql = function(rawSql) {
    var filterQuery = ['SELECT * FROM ({_sql}) _cdb_bbox_filter',
        ' WHERE {_column} && ST_Transform(ST_MakeEnvelope({_bbox}, 4326), {_srid})'
    ].join('\n');
    return format(filterQuery, {
        _sql: rawSql,
        _column: this.column,
        _srid: this.srid,
        _bbox: this.bbox
    });
};
