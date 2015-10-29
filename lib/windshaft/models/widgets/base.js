var format = require('../../utils/format');

module.exports.bboxSql = function bboxSql(sql, bbox) {
    if (bbox) {
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

        var bboxFilterQuery = ['SELECT * FROM ({_sql}) _cdb_bbox_filter',
            ' WHERE the_geom_webmercator && ST_Transform(ST_MakeEnvelope({_bbox}, 4326), 3857)'
        ].join('\n');

        return format(bboxFilterQuery, { _sql: sql, _bbox: bbox });
    }
    return sql;
};