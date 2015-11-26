'use strict';

function prepareQuery(sql) {
  var affectedTableRegexCache = {
      bbox: /!bbox!/g,
      scale_denominator: /!scale_denominator!/g,
      pixel_width: /!pixel_width!/g,
      pixel_height: /!pixel_height!/g
  };

  return sql
      .replace(affectedTableRegexCache.bbox, 'ST_MakeEnvelope(0,0,0,0)')
      .replace(affectedTableRegexCache.scale_denominator, '0')
      .replace(affectedTableRegexCache.pixel_width, '1')
      .replace(affectedTableRegexCache.pixel_height, '1');
}

module.exports.extractTableNames = function extractTableNames(query) {
    return [
        'SELECT * FROM CDB_QueryTablesText($windshaft$',
        prepareQuery(query),
        '$windshaft$) as tablenames'
    ].join('');
};

module.exports.getAditionalColumnsQuery = function getAditionalColumnsQuery(tablename) {
    return [
        'SELECT COLUMN_NAME::VARCHAR(50) ',
        'FROM INFORMATION_SCHEMA.COLUMNS ',
    	'WHERE TABLE_NAME=',
        '\'' + tablename + '\' ',
    	'AND COLUMN_NAME NOT IN (',
        '\'cartodb_id\', \'updated_at\', \'created_at\', \'the_geom_webmercator\', \'the_geom\')',
    ].join('');
};

module.exports.getColumnNamesFromQuery = function extractTableNames(query) {
    return [
        'SELECT * FROM (',
        prepareQuery(query),
        ') as columnNames limit 0'
    ].join('');
};
