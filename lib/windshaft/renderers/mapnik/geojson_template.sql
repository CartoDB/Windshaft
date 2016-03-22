WITH
__simplified_geometries AS (
    SELECT
    {{ if (it.columns && it.columns.length > 0) { }}
        {{= it.columns }},
    {{ } }}
    ST_Simplify(
        {{?it.removeRepeatedPoints}}ST_RemoveRepeatedPoints({{?}}
            {{= it.clipFn }}(
                ST_MakeValid(__cdb_query.{{= it.geomColumn }}),
                ST_Expand(
                    ST_MakeEnvelope({{= it.extent.xmin }}, {{= it.extent.ymin }}, {{= it.extent.xmax }}, {{= it.extent.ymax }}, {{= it.srid }}),
                    {{= it.xyzResolution }} * {{= it.bufferSize}}
                )
            ){{?it.removeRepeatedPoints}},
            {{= it.xyzResolution }} * {{= it.removeRepeatedPointsTolerance}}
        ){{?}},
        {{= it.xyzResolution }} * {{= it.simplifyDpRatio}}
    ) __the_geometry
    FROM ({{= it.layerSql }}) AS __cdb_query
    WHERE (
        ST_Intersects(
            __cdb_query.{{= it.geomColumn }},
            ST_Expand(
                ST_MakeEnvelope({{= it.extent.xmin }}, {{= it.extent.ymin }}, {{= it.extent.xmax }}, {{= it.extent.ymax }}, {{= it.srid }}),
                {{= it.xyzResolution }} * {{= it.bufferSize}}
            )
        )
    )
),
__filtered_geometries AS (
    SELECT * FROM __simplified_geometries WHERE NOT ST_IsEmpty(__the_geometry)
)
SELECT row_to_json(featurecollection) as geojson
FROM (
    SELECT 'FeatureCollection' AS TYPE,
        array_to_json(array_agg(feature)) AS features
        FROM (
            SELECT 'Feature' AS TYPE,
            ST_AsGeoJSON(__the_geometry)::json AS geometry,
            {{ if (!it.columns || it.columns.length === 0) { }}
                '{}'::json
            {{ } else { }}
                row_to_json((SELECT l FROM (SELECT {{= it.columns }}) AS l))
            {{ } }} AS properties
            FROM __filtered_geometries
        ) AS feature
) AS featurecollection;
