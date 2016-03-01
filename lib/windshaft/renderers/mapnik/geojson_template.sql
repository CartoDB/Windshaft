SELECT
  row_to_json(featurecollection) as geojson
FROM (
  SELECT
    'FeatureCollection' AS TYPE,
    array_to_json(
      array_agg(feature)
    ) AS features
  FROM (
    SELECT
      'Feature' AS TYPE,
      st_asgeojson(
        {{ if (it.clipByBox2d) { }}
        st_clipbybox2d(
        {{ } else { }}
        st_intersection(
        {{ } }}
          st_simplify(
            st_makevalid(tbl.{{= it.geomColumn }}),
            cdb_xyz_resolution({{= it.zoom }}) * (1.0 / 20.0),
            true
          ),
          st_expand(
            cdb_xyz_extent({{= it.coord.x }}, {{= it.coord.y }}, {{= it.zoom }}),
            cdb_xyz_resolution({{= it.zoom }}) * {{= it.bufferSize}}
          )
        )
      )::json AS geometry,
      {{ if (!it.columns || it.columns.length === 0) { }}
      '{}'::json
      {{ } else { }}
      row_to_json(
        (
          SELECT
            l
          FROM (
            SELECT
              {{ for (var i = 0; i < it.columns.length; i++) { }}
                {{= it.columns[i] }}{{ if (i < (it.columns.length - 1)) { }},{{ } }}
              {{ } }}
          ) AS l
        )
      )
      {{ } }}
      AS properties
    FROM
      ({{= it.layerSql }}) AS tbl
    WHERE (
      {{= it.geomColumn }}
      &&
      st_expand(
        cdb_xyz_extent({{= it.coord.x }}, {{= it.coord.y }}, {{= it.zoom }}),
        cdb_xyz_resolution({{= it.zoom }}) * {{= it.bufferSize}}
      )
    )
  ) AS feature
) AS featurecollection;
