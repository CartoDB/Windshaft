SELECT row_to_json(featurecollection) as geojson
FROM (
    SELECT 'FeatureCollection' AS TYPE,
        array_to_json(array_agg(feature)) AS features
        FROM (
            SELECT 'Feature' AS TYPE,
            ST_AsGeoJSON(
                ST_Simplify(
                    {{?it.removeRepeatedPoints}}ST_RemoveRepeatedPoints({{?}}
                        {{= it.clipFn }}(
                            ST_MakeValid(tbl.{{= it.geomColumn }}),
                            ST_Expand(
                                ST_MakeEnvelope({{= it.extent.xmin }}, {{= it.extent.ymin }}, {{= it.extent.xmax }}, {{= it.extent.ymax }}, {{= it.srid }}),
                                {{= it.xyzResolution }} * {{= it.bufferSize}}
                            )
                        ){{?it.removeRepeatedPoints}},
                        {{= it.xyzResolution }} * {{= it.removeRepeatedPointsTolerance}}
                    ){{?}},
                    {{= it.xyzResolution }} * {{= it.simplifyDpRatio}}
                )
            )::json AS geometry,
            {{ if (!it.columns || it.columns.length === 0) { }}
                '{}'::json
            {{ } else { }}
                row_to_json((SELECT l FROM (SELECT {{= it.columns }}) AS l))
            {{ } }} AS properties
            FROM ({{= it.layerSql }}) AS tbl
            WHERE (
                ST_Intersects(
                    tbl.{{= it.geomColumn }},
                    ST_Expand(
                        ST_MakeEnvelope({{= it.extent.xmin }}, {{= it.extent.ymin }}, {{= it.extent.xmax }}, {{= it.extent.ymax }}, {{= it.srid }}),
                        {{= it.xyzResolution }} * {{= it.bufferSize}}
                    )
                )
            )
        ) AS feature
) AS featurecollection;
