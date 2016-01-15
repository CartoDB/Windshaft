// CartoDB Vector Overviews support functions

// Build UNION expression to replace table, using overviews metadata
// overviews metadata: { 1: 'table_ov1', ... }
// assume table and overview names include schema if necessary and are quoted as needed
// TODO: consider passing separate schema and table/ov names unquoted
function overviews_view_for_table(table, overviews_metadata) {
  var cond, condition, i, len, ov_table, overview_layers, selects, sql, z_hi, z_low;

  sorted_overviews = []; // [[1, 'table_ov1'], ...]
  for (z in overviews_metadata) {
    sorted_overviews.push([z, overviews_metadata[z]]);
  }
  sorted_overviews.sort(function(a, b){ return a[0]-b[0]; })

  overview_layers = [];
  z_low = null;
  for (i = 0, len = sorted_overviews.length; i < len; i++) {
    z_hi = sorted_overviews[i][0];
    ov_table = sorted_overviews[i][1];
    if (z_low != null) {
      if (z_low === z_hi - 1) {
        condition = "cdb_z = " + z_hi;
      } else {
        condition = "cdb_z > " + z_low + " AND cdb_z <= " + z_hi;
      }
    } else {
      if (z_hi === 0) {
        condition = "cdb_z = " + z_hi;
      } else {
        condition = "cdb_z <= " + z_hi;
      }
    }
    overview_layers.push([condition, ov_table]);
    z_low = z_hi;
  }
  overview_layers.push(["cdb_z > " + z_low, table]);

  selects = [];
  for (i = 0, len = overview_layers.length; i < len; i++) {
    cond = overview_layers[i][0];
    ov_table = overview_layers[i][1];
    selects.push("SELECT * FROM " + ov_table + ", cdb_scale WHERE " + cond);
  }

  return selects.join("\n UNION ALL \n");
};

// name to be used for the view of the table using overviews
function overviews_view_name(table) {
  // TODO: hadle quoting/schema (result should not have schema name)
  return table + '_cdb_vov';
};

// replace a table name in a query by anoter name
function replace_table_in_query(sql, old_table, new_table) {
  return sql.replace(new RegExp(old_table, 'g'), new_table);
};

// Substitute tables by overviews query
// overviews contains metadata about the overviews to be used:
//     { 'table-name': {1: 'overview-table-1', ... }, ... }
function overviews_query(query, overviews) {
  var sql = "WITH cdb_scale AS ( SELECT CDB_ZoomFromScale(!scale_denominator!) AS cdb_z )\n";
  for (table in overviews) {
    table_overviews = overviews[table];
    table_view = overviews_view_name(table);
    query = replace_table_in_query(query, table, table_view);
    sql += ", " + table_view + " AS (" + overviews_view_for_table(table, table_overviews) + ")\n";
  }
  sql += query;
  return sql;
};

module.exports = { query: overviews_query };
