SELECT row_to_json(fc) as geojson
 FROM (SELECT 'FeatureCollection' AS TYPE, array_to_json(array_agg(f)) AS features
   FROM (SELECT 'Feature' AS TYPE , ST_AsGeoJSON(lg.<%= geomColumn %>)::json AS geometry
     FROM (<%= layerSql %>) AS lg WHERE <%= geomColumn %> && CDB_XYZ_Extent(<%= coord.x %>, <%= coord.y %>, <%= zoom %>)) AS f )  AS fc;
