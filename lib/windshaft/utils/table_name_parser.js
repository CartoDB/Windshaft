// Quote an PostgreSQL identifier if ncecessary
function quote_identifier_if_needed(txt) {
    if ( txt && !txt.match(/^[a-z_][a-z_0-9]*$/)) {
        return '"' + txt.replace(/\"/g, '""') + '"';
    } else {
        return txt;
    }
}

// Parse PostgreSQL table name (possibly quoted and with optional schema).+
// Returns { schema: 'schema_name', table: 'table_name' }
function parse_table_name(table) {

    function split_as_quoted_parts(table_name) {
      // parse table into 'parts' that may be quoted, each part
      // in the parts array being an object { part: 'text', quoted: false/true }
     var parts = [];
     var splitted = table_name.split(/\"/);
     for (var i=0; i<splitted.length; i++ ) {
       if ( splitted[i] === '' ) {
         if ( parts.length > 0 && i < splitted.length-1 ) {
             i++;
             parts[parts.length - 1].part += '"' + splitted[i];
         }
       }
       else {
         var is_quoted = (i > 0 && splitted[i-1] === '') ||
                         (i < splitted.length - 1 && splitted[i+1] === '');
             parts.push({ part: splitted[i], quoted: is_quoted });
       }
     }
     return parts;
    }

    var parts = split_as_quoted_parts(table);

    function split_single_part(part) {
        var schema_part = null;
        var table_part = null;
        if ( part.quoted ) {
            table_part = part.part;
        } else {
            var parts = part.part.split('.');
            if ( parts.length === 1 ) {
                schema_part = null;
                table_part = parts[0];
            } else if ( parts.length === 2 ) {
                schema_part = parts[0];
                table_part = parts[1];
            } // else invalid table name
        }
        return {
            schema: schema_part,
            table:  table_part
        };
    }

    function split_two_parts(part1, part2) {
        var schema_part = null;
        var table_part = null;
        if ( part1.quoted && !part2.quoted ) {
            if ( part2.part[0] === '.' ) {
                schema_part = part1.part;
                table_part = part2.part.slice(1);
            } // else invalid table name (missing dot)
        } else if ( !part1.quoted && part2.quoted ) {
            if ( part1.part[part1.part.length - 1] === '.' ) {
                schema_part = part1.part.slice(0, -1);
                table_part = part2.part;
            } // else invalid table name (missing dot)
        } // else invalid table name (missing dot)
        return {
            schema: schema_part,
            table:  table_part
        };
    }

    if ( parts.length === 1 ) {
        return split_single_part(parts[0]);
    } else if ( parts.length === 2 ) {
        return split_two_parts(parts[0], parts[1]);
    } else if ( parts.length === 3 && parts[1].part === '.' ) {
        return {
            schema: parts[0].part,
            table:  parts[2].part
        };
    } // else invalid table name
}

function table_identifier(parsed_name) {
    if ( parsed_name && parsed_name.table ) {
        if ( parsed_name.schema ) {
            return quote_identifier_if_needed(parsed_name.schema) + '.' + quote_identifier_if_needed(parsed_name.table);
        } else {
            return quote_identifier_if_needed(parsed_name.table);
        }
    } else {
        return null;
    }
}

module.exports = {
  parse: parse_table_name,
  quote: quote_identifier_if_needed,
  table_identifier: table_identifier
};
