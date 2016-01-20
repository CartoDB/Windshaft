// Vector Overviews support functions

// TODO: replace cdb_ prefixes
// TODO: indent properly!!

// Build UNION expression to replace table, using overviews metadata
// overviews metadata: { 1: 'table_ov1', ... }
// assume table and overview names include schema if necessary and are quoted as needed
// TODO: consider passing separate schema and table/ov names unquoted
function overviews_view_for_table(table, overviews_metadata) {
  var condition, i, len, ov_table, overview_layers, selects, z_hi, z_lo;

  var sorted_overviews = []; // [[1, 'table_ov1'], ...]
  for (var z in overviews_metadata) {
    if (overviews_metadata.hasOwnProperty(z)) {
      sorted_overviews.push([z, overviews_metadata[z].table]);
    }
  }
  sorted_overviews.sort(function(a, b){ return a[0]-b[0]; });

  overview_layers = [];
  z_lo = null;
  for (i = 0, len = sorted_overviews.length; i < len; i++) {
    z_hi = sorted_overviews[i][0];
    ov_table = sorted_overviews[i][1];
    overview_layers.push([overview_z_condition(z_lo, z_hi), ov_table]);
    z_lo = z_hi;
  }
  overview_layers.push(["cdb_z > " + z_lo, table]);

  selects = [];
  for (i = 0, len = overview_layers.length; i < len; i++) {
    condition = overview_layers[i][0];
    ov_table = overview_layers[i][1];
    selects.push("SELECT * FROM " + ov_table + ", cdb_scale WHERE " + condition);
  }

  return selects.join("\n UNION ALL \n");
}

function overview_z_condition(z_lo, z_hi) {
  if (z_lo !== null) {
    if (z_lo === z_hi - 1) {
      return "cdb_z = " + z_hi;
    } else {
      return "cdb_z > " + z_lo + " AND cdb_z <= " + z_hi;
    }
  } else {
    if (z_hi === 0) {
      return "cdb_z = " + z_hi;
    } else {
      return "cdb_z <= " + z_hi;
    }
  }
}

// name to be used for the view of the table using overviews
function overviews_view_name(table) {
  // TODO: hadle quoting/schema (result should not have schema name)
  return table + '_cdb_vov';
}

// replace a table name in a query by anoter name
function replace_table_in_query(sql, old_table, new_table) {
  return sql.replace(new RegExp(old_table, 'g'), new_table);
}

function replace_table_in_style(style, old_table, new_table) {
  return style.replace(new RegExp(old_table, 'g'), new_table);
}

// Substitute tables by overviews query
// overviews contains metadata about the overviews to be used:
//     { 'table-name': {1: { table: 'overview-table-1' }, ... }, ... }
function overviews_query(query, overviews) {
  if ( !overviews ) {
    return query;
  }
  var replaced_query = query;
  var sql = "WITH cdb_scale AS ( SELECT CDB_ZoomFromScale(!scale_denominator!) AS cdb_z )\n";
  for ( var table in overviews ) {
    if (overviews.hasOwnProperty(table)) {
      var table_overviews = overviews[table];
      var table_view = overviews_view_name(table);
      replaced_query = replace_table_in_query(replaced_query, table, table_view);
      sql += ", " + table_view + " AS (" + overviews_view_for_table(table, table_overviews) + ")\n";
    }
  }
  if ( replaced_query !== query ) {
    sql += replaced_query;
  } else {
    sql = query;
  }
  return sql;
}

function overviews_style(cartocss, cartocss_version, overviews) {
  if ( !overviews ) {
    return cartocss;
  }
  for ( var table in overviews ) {
    if (overviews.hasOwnProperty(table)) {
      var table_view = overviews_view_name(table);
      cartocss = replace_table_in_style(cartocss, table, table_view);
    }
  }
  return [cartocss, cartocss_version];
}

module.exports = { query: overviews_query, style: overviews_style };
