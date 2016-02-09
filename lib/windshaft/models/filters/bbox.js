var debug = require('debug')('windshaft:filter:bbox');
var format = require('../../utils/format');

var LATITUDE_MAX_VALUE = 85.0511287798066;
var LONGITUDE_LOWER_BOUND = -180;
var LONGITUDE_UPPER_BOUND = 180;
var LONGITUDE_RANGE = LONGITUDE_UPPER_BOUND - LONGITUDE_LOWER_BOUND;

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

    var bboxElements = bbox.split(',').map(function(e) { return +e; });

    validateBboxElements(bboxElements);

    this.column = filterDefinition.column || 'the_geom_webmercator';
    this.srid = filterDefinition.srid || 3857;

    // Latitudes must be within max extent
    var south = Math.max(bboxElements[1], -LATITUDE_MAX_VALUE);
    var north = Math.min(bboxElements[3], LATITUDE_MAX_VALUE);

    // Longitudes crossing 180º need another approach
    var adjustedLongitudeRange = adjustLongitudeRange([bboxElements[0], bboxElements[2]]);
    var west = adjustedLongitudeRange[0];
    var east = adjustedLongitudeRange[1];

    this.bboxes = getBoundingBoxes(west, south, east, north);
}

function getBoundingBoxes(west, south, east, north) {
    var bboxes = [];

    if (east - west >= 360) {
        bboxes.push([-180, south, 180, north]);
    } else if (west >= -180 && east <= 180) {
        bboxes.push([west, south, east, north]);
    } else {
        bboxes.push([west, south, 180, north]);
        bboxes.push([-180, south, east % 180, north]);
    }

    return bboxes;
}

function validateBboxElements(bboxElements) {
    var isNumericBbox = bboxElements
        .map(function(n) { return Number.isFinite(n); })
        .reduce(function(allFinite, isFinite) {
            if (!allFinite) {
                return false;
            }
            return isFinite;
        }, true);

    if (bboxElements.length !== 4 || !isNumericBbox) {
        throw new Error('Invalid bbox filter, expected format="west,south,east,north"');
    }
}

function adjustLongitudeRange(we) {
    var west = we[0];
    west -= LONGITUDE_LOWER_BOUND;
    west = west - (LONGITUDE_RANGE * Math.floor(west / LONGITUDE_RANGE)) + LONGITUDE_LOWER_BOUND;

    var longitudeRange = Math.min(we[1] - we[0], 360);

    return [west, west + longitudeRange];
}

module.exports = BBox;

module.exports.adjustLongitudeRange = adjustLongitudeRange;
module.exports.LATITUDE_MAX_VALUE = LATITUDE_MAX_VALUE;
module.exports.LONGITUDE_MAX_VALUE = LONGITUDE_UPPER_BOUND;

var filterQuery = [
    'SELECT * FROM ({_sql}) _cdb_bbox_filter',
    'WHERE {_filters}'
].join('\n');

var bboxFilter = '{_column} && ST_Transform(ST_MakeEnvelope({_bbox}, 4326), {_srid})';
BBox.prototype.sql = function(rawSql) {
    var bboxSql = format(filterQuery, {
        _sql: rawSql,
        _filters: this.bboxes.map(function(bbox) {
            return format(bboxFilter, {
                _column: this.column,
                _bbox: bbox.join(','),
                _srid: this.srid
            });
        }.bind(this)).join(' OR ')
    });

    debug(bboxSql);

    return bboxSql;
};
