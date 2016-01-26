var TableNameParser = require('./table_name_parser');

// Vector Overviews support functions

// TODO: some names are introudced in the queries, and the
// '_vovw_' (for vector overviews) is used in them, but no check
// is performed for conflicts with existing identifiers in the query.

// Build UNION expression to replace table, using overviews metadata
// overviews metadata: { 1: 'table_ov1', ... }
// assume table and overview names include schema if necessary and are quoted as needed
function overviews_view_for_table(table, overviews_metadata, indent) {
    // jshint maxcomplexity:7
    var condition, i, len, ov_table, overview_layers, selects, z_hi, z_lo;
    var parsed_table = TableNameParser.parse(table);

    var sorted_overviews = []; // [[1, 'table_ov1'], ...]

    indent = indent || '    ';
    for (var z in overviews_metadata) {
        if (overviews_metadata.hasOwnProperty(z)) {
            sorted_overviews.push([z, overviews_metadata[z].table]);
        }
    }
    sorted_overviews.sort(function(a, b){ return a[0]-b[0]; });

    overview_layers = [];
    z_lo = null;
    for (i = 0, len = sorted_overviews.length; i < len; i++) {
        z_hi = parseInt(sorted_overviews[i][0]);
        ov_table = sorted_overviews[i][1];
        overview_layers.push([overview_z_condition(z_lo, z_hi), ov_table]);
        z_lo = z_hi;
    }
    overview_layers.push(["_vovw_z > " + z_lo, table]);

    selects = [];
    for (i = 0, len = overview_layers.length; i < len; i++) {
        condition = overview_layers[i][0];
        ov_table = TableNameParser.parse(overview_layers[i][1]);
        ov_table.schema = ov_table.schema || parsed_table.schema;
        var ov_identifier = TableNameParser.table_identifier(ov_table);
        selects.push(indent + "SELECT * FROM " + ov_identifier + ", _vovw_scale WHERE " + condition);
    }

    return selects.join("\n"+indent+"UNION ALL\n");
}

function overview_z_condition(z_lo, z_hi) {
    if (z_lo !== null) {
        if (z_lo === z_hi - 1) {
            return "_vovw_z = " + z_hi;
        } else {
            return "_vovw_z > " + z_lo + " AND _vovw_z <= " + z_hi;
        }
    } else {
        if (z_hi === 0) {
            return "_vovw_z = " + z_hi;
        } else {
            return "_vovw_z <= " + z_hi;
        }
    }
}

// name to be used for the view of the table using overviews
function overviews_view_name(table) {
    var parsed_table = TableNameParser.parse(table);
    parsed_table.table = '_vovw_' + parsed_table.table;
    parsed_table.schema = null;
    return TableNameParser.table_identifier(parsed_table);
}

// replace a table name in a query by anoter name
function replace_table_in_query(sql, old_table_name, new_table_name) {
    var old_table = TableNameParser.parse(old_table_name);
    var new_table = TableNameParser.parse(new_table_name);
    var old_table_ident = TableNameParser.table_identifier(old_table);
    var new_table_ident = TableNameParser.table_identifier(new_table);

    var regexp = '';
    var replacement = '';
    if ( old_table.schema ) {
        // replace table name including schema prefix
        if ( old_table_ident[0] !== '"' ) {
          regexp = '\\b';
        }
        replacement = new_table_ident;
    } else {
       // replace table name without schema
       regexp = '([^\.a-z0-9_]|^)';
       replacement = '$01'+new_table_ident;
    }
    regexp += old_table_ident;
    if ( old_table_ident[old_table_ident.length-1] !== '"' ) {
      regexp += '\\b';
    }
    return sql.replace(new RegExp(regexp, 'g'), replacement);
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
    var sql = "WITH\n  _vovw_scale AS ( SELECT CDB_ZoomFromScale(!scale_denominator!) AS _vovw_z )";
    for ( var table in overviews ) {
        if (overviews.hasOwnProperty(table)) {
            var table_overviews = overviews[table];
            var table_view = overviews_view_name(table);
            replaced_query = replace_table_in_query(replaced_query, table, table_view);
            sql += ",\n  " + table_view + " AS (\n" + overviews_view_for_table(table, table_overviews) + "\n  )";
        }
    }
    if ( replaced_query !== query ) {
        sql += "\n";
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
    return cartocss;
}

module.exports = { query: overviews_query, style: overviews_style };
