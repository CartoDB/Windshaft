Windshaft-cartodb metrics
=========================

## Timers
The next list includes the API endpoints, each endpoint may have several inner timers, some of them are displayed within this list as subitems. Find the description for them in the Inner timers section.
- **windshaft.createmap_get**: time to create a map's layergroup via HTTP GET
    + createLayergroup
- **windshaft.createmap_post**: time to create a map's layergroup via HTTP POST
    + createLayergroup
- **windshaft.del_style**: time to remove a map style
- **windshaft.get_slash**: time to GET the health check
- **windshaft.get_style**: time to retrieve the carto style for a given map
- **windshaft.get_version**: time to GET information about software versions
- **windshaft.map_tile**: time to retrieve a tile or grid from a given token
    + getTileOrGrid
- **windshaft.maplayer_tile**: time to retrieve a tile for a given token and layer tuple
    + getTileOrGrid
- **windshaft.maplayer_attribute**: time to retrieve an attribute for a token and layer tuple
- **windshaft.post_style**: time to set a new map style
- **windshaft.tiles**: time to retrieve a tile or grid with all the params in the URL
    + getTileOrGrid

### Inner timers
Again, each inner timer may have several inner timers, some of them are displayed within this list as subitems.
- **createLayergroup**: time to create, store and test a layergroup for a map
    + afterLayergroupCreate
    + getTileOrGrid
    + layerCheck
    + makeRenderer-*{format}* \*
    + mapSave
    + req2params
- **getTileOrGrid**: time to retrieve a tile or grid
    + getRenderer
    + makeRenderer-*{format}* \*
    + render-*{format}* \*
    + renderer_release
- **MapStore.load**: time to retrieve the configuration associated to a layergroup token from redis
- **afterLayergroupCreate**: time to execute actions after layergroup creation
- **afterStyleChange**: time to execute actions after map style is changed
- **afterTileRender**: time to execute actions after map tile is rendered
- **beforeStateChange**: time to execute actions after map style is changed or deleted
- **beforeTileRender**: time to execute actions before a map tile is rendered
- **formatAttributes**: time to prepare attributes once retrived from the database
- **getAttributes**: time to retrieve layer attributes from database
- **getRenderer**: time to retrieve a renderer for a given request, see *makeRenderer*
- **layerCheck**: time to validate the initialization of a layergroup
- **makeRenderer-*{format}* \***: time to create a renderer
- **mapSave**: time to store the configuration associated to a layergroup token in redis
- **render-*{format}* \***: time to render a tile from the renderer
- **renderer_release**: time to release a cached renderer
- **req2params**: time to parse and prepare the request parameters
- **setStyle**: time to set a style for a map

## Counters
- **windshaft.tiles.error**: number of tiles request that failed
- **windshaft.tiles.success**: number of tiles request that succeeded
- **windshaft.tiles.*{format}*.error**: per format number of tiles request that failed
- **windshaft.tiles.*{format}*.success**: per format number of tiles request that succeeded

## MAPNIK
Currently any measure taken in Mapnik is also returned, with 'Mk_' prepended. Here is a list of the ones currently being used:

### Timers:
- **Mk_All**: The full amount of time (ms) spent in the Mapnik library (doesn't include any time spent in the node modules)
- **Mk_Setup**: Time spent in the tasks needed to start the rendering (mainly DB).
- **Mk_Datasource**: Time spent only the DB calls (included in 'Mk_Setup').
- **Mk_Render**: Time spent rendering
- **Mk_Render_Style:**: Time spent rendering the styles (included in 'Mk_Render').
- **Mk_Agg_PXXS**: Time spent in the Agg renderer with the symbolizer 'XX', where 'XX' can be: 'Build', 'Debug', 'Dot', 'Group', 'LinePattern', 'Line', 'Marker', 'Point', 'Polygon', 'PolygonPattern', 'Raster', 'Shield', 'Text'.
- **Mk_Grid_PXXS**: Time spent in the Grid renderer with the symbolizer 'XX', where 'XX' can be: 'Build', 'Group', 'LinePattern', 'Line', 'Marker', 'Point', 'Polygon', 'PolygonPattern', 'Raster', 'Shield', 'Text'.

### Counters:
- **Mk_Features_cnt_XX**: Number of features rendered of type 'XX', where 'XX' can be: 'Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection', 'Unknown'.
- **Mk_Agg_PMS_AttrCache_Miss** and **Agg_PMS_EllipseCache_Miss**: In the render marker symbolizer, they count the cache misses for the attributes cache (and ellipse if applicable). Note: The hits can be calculated by substracting the number of features to this value.
- **Mk_Agg_PMS_ImageCache_Miss** and **Agg_PMS_ImageCache_Ignored**: For the Agg renderer and Marker Symbolizer, they count the number of cache misses ('_Miss') and ignores ('_Ignored') which could be due to the cache being deactivated or the attributes not being cacheable (e.g. using scaling).

\* ***{format}*** is one of the following:
* png
* grid_json
* json_torque
