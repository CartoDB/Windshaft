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

module.exports.getColumnNamesFromQuery = function extractTableNames(query) {
    return [
        'SELECT * FROM (',
        prepareQuery(query),
        ') as columnNames limit 0'
    ].join('');
};

module.exports.getTableStats = function getTableStats(table, geomColumn) {
    geomColumn = geomColumn || 'the_geom';

    return [
        'with feature_stats AS (',
        '    select (_postgis_stats(',
        '        \'' + table + '\'::regclass, \'' + geomColumn + '\'',
        '    )::json ->> \'table_features\')::numeric as features',
        '),',
        'vertex_stats as (',
        '    select sum(ST_NPoints(' + geomColumn + ')) as vertexes from ' + table,
        ')',
        'select * from feature_stats, vertex_stats'
    ].join('\n');
};
