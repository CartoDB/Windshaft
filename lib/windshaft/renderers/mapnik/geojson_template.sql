SELECT row_to_json(featurecollection) as geojson
FROM (
    SELECT 'FeatureCollection' AS TYPE,
        array_to_json(array_agg(feature)) AS features
        FROM (
            SELECT 'Feature' AS TYPE,
            ST_AsGeoJSON({{= it.clipFn }}(
                ST_MakeValid(
                    ST_Simplify(
                        {{ if (it.removeRepeatedPoints) { }}
                        ST_RemoveRepeatedPoints(
                            ST_MakeValid(tbl.{{= it.geomColumn }}),
                            {{= it.xyzResolution }} * (1.0 / 20.0)
                        ),
                        {{ } else { }}
                        ST_MakeValid(tbl.{{= it.geomColumn }}),
                        {{ } }}
                        {{= it.xyzResolution }} * (1.0 / 20.0)
                    )
                ),
                ST_Expand(
                    ST_MakeEnvelope({{= it.extent.xmin }}, {{= it.extent.ymin }}, {{= it.extent.xmax }}, {{= it.extent.ymax }}, {{= it.srid }}),
                    {{= it.xyzResolution }} * {{= it.bufferSize}}
                )
            ))::json AS geometry,
            {{ if (!it.columns || it.columns.length === 0) { }}
                '{}'::json
            {{ } else { }}
                row_to_json((SELECT l FROM (SELECT {{=it.columns}}) AS l))
            {{ } }} AS properties
            FROM ({{= it.layerSql }}) AS tbl
            WHERE (
                ST_Intersects(
                    {{= it.geomColumn }},
                    ST_Expand(
                        ST_MakeEnvelope({{= it.extent.xmin }}, {{= it.extent.ymin }}, {{= it.extent.xmax }}, {{= it.extent.ymax }}, {{= it.srid }}),
                        {{= it.xyzResolution }} * {{= it.bufferSize}}
                    )
                )
            )
        ) AS feature
) AS featurecollection;
