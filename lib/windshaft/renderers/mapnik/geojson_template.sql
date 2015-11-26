SELECT row_to_json(featcoll) as geojson FROM
  (SELECT 'FeatureCollection' AS TYPE, array_to_json(array_agg(feat)) AS features FROM
    (SELECT 'Feature' AS TYPE, ST_AsGeoJSON(tbl.<%= geomColumn %>)::json AS geometry, <% if (!columns || columns.length === 0) {%> '{}'::json <% } else {%> row_to_json(
      (SELECT l FROM
        (SELECT <% _.each(columns, function(col, i) { %> <%= col %> <% if (i < (columns.length - 1)) {%>, <% } %> <% }); %>) AS l
      )
    ) <% } %> AS properties
    FROM (<%= layerSql %>) AS tbl
    WHERE <%= geomColumn %> && CDB_XYZ_Extent(<%= coord.x %>, <%= coord.y %>, <%= zoom %>)) AS feat) AS featcoll;