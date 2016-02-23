SELECT row_to_json(featcoll) as geojson FROM
  (SELECT 'FeatureCollection' AS TYPE, array_to_json(array_agg(feat)) AS features FROM
    (SELECT 'Feature' AS TYPE, ST_AsGeoJSON({{ if (it.clipByBox2d) { }}ST_ClipByBox2D{{ } else { }}ST_Intersection{{ } }}(st_makevalid(tbl.{{= it.geomColumn }}), st_expand(CDB_XYZ_Extent({{= it.coord.x }}, {{= it.coord.y }}, {{= it.zoom }}), {{= it.bufferDistance}})))::json AS geometry, {{ if (!it.columns || it.columns.length === 0) { }} '{}'::json {{ } else { }} row_to_json(
      (SELECT l FROM
        (SELECT {{ for (var i = 0; i < it.columns.length; i++) { }} {{= it.columns[i] }} {{ if (i < (it.columns.length - 1)) { }}, {{ } }} {{ } }}) AS l
      )
    ) {{ } }} AS properties
    FROM ({{= it.layerSql }}) AS tbl
    WHERE st_makevalid({{= it.geomColumn }}) && st_expand(CDB_XYZ_Extent({{= it.coord.x }}, {{= it.coord.y }}, {{= it.zoom }}), {{= it.bufferDistance}})) AS feat) AS featcoll;
