# 1. Purpose

This specification describes
[MapConfig](MapConfig-specification) format version 1.2.0.


# 2. File format

Layergroup files use the JSON format as described in [RFC 4627](http://www.ietf.org/rfc/rfc4627.txt).

```javascript
{
        // OPTIONAL
        // default map extent, in map projection
        // (only webmercator supported at this version)
        extent: [-20037508.5, -20037508.5, 20037508.5, 20037508.5],

        // OPTIONAL
        // Spatial reference identifier for the map
        // Defaults to 3857
        srid: 3857,

        // OPTIONAL
        // maxzoom to be renderer. From this zoom tiles will respond 404
        // default: undefined (infinite)
        maxzoom: 18,

        // OPTIONAL
        // minzoom to be renderer. From this zoom tiles will respond 404. Must be less than maxzoom
        // default: 0
        minzoom:3,

        // REQUIRED
        // Array of layers defined in render order. Different kind of layers supported
        // are described below
        layers: [{

             // REQUIRED
             // string, sets layer type, can take 3 values:
             //  - 'mapnik'  - rasterize tiles
             //  - 'cartodb' - an alias for mapnik, for backward compatibility
             //  - 'torque'  - render vector tiles in torque format (to be linked)
             type: 'mapnik',

             // REQUIRED
             // object, set different options for each layer type, there are 3 common mandatory attributes
             options: {
               // REQUIRED
               // string, SQL to be performed on user database to fetch the data to be rendered.
               //
               // It should select at least the columns specified in ``geom_column``,
               // ``interactivity`` and  ``attributes`` configurations below.
               //
               // For ``mapnik`` layers it can contain substitution tokens !bbox!,
               // !pixel_width! and !pixel_height!, see implication of that in the
               // ``attributes`` configuration below.
               //
               sql: 'select * from table',

               // OPTIONAL
               // name of the column containing the geometry
               // Defaults to 'the_geom_webmercator'
               geom_column: 'the_geom_webmercator',

               // OPTIONAL
               // type of column, can be 'geometry' or 'raster'
               // Defaults to 'geometry'
               geom_type: 'geometry',

               // OPTIONAL
               // raster band, only valid when geom_type = 'raster'.
               // If 0 or not specified makes rasters being interpreted
               // as either grayscale (for single bands) or RGB (for 3 bands)
               // or RGBA (for 4 bands).
               // Defaults to 0
               raster_band: '1',

               // OPTIONAL
               // spatial reference identifier of the geometry column
               // Defaults to 3857
               srid: 3857,

               // REQUIRED
               // string, CartoCSS style to render the tiles
               //
               // CartoCSS specification depend on layer type:
               //  Torque: http://github.com/CartoDB/torque/blob/2.2.00/lib/torque/cartocss_reference.js
               //  Mapnik: http://github.com/mapnik/mapnik-reference/blob/v5.0.7/2.2.0/reference.json
               cartocss: '#layer { ... }',

               // REQUIRED
               // string, CartoCSS style version of cartocss attribute
               // global_cartocss_version takes precedence over this, if present
               //
               // Version semantic is specific to the layer type.
               //
               cartocss_version: '2.0.1',

               // OPTIONAL
               // string array, contains tables that SQL uses. It used when affected tables can't be
               // guessed from SQL (for example, plsql functions are used)
               affected_tables: [ 'table1', 'schema.table2', '"MixedCase"."Table"' ],

               // OPTIONAL
               // string array, contains fields renderer inside grid.json
               // all the params should be exposed by the results of executing the query in sql attribute
               interactivity: [ 'field1', 'field2', .. ]

               // OPTIONAL
               // values returned by attributes service (disabled if no config is given)
               // NOTE: enabling the attribute service is forbidden if the "sql" option contains
               //       substitution token that make it dependent on zoom level or viewport extent.
               attributes: {
                 // REQUIRED
                 // used as key value to fetch columns
                 id: 'identifying_column',

                 // REQUIRED
                 // string list of columns returned by attributes service
                 columns: ['column1', 'column2']
               }
             }
        }]
    }
```
# Extensions

The document may be extended for specific uses.
For example, Windshaft-CartoDB defines the addition of a "stats_tag" element
in the config. See https://github.com/CartoDB/Windshaft-cartodb/wiki/MultiLayer-API

Specification for how to name extensions is yet to be defined as of this version
of MapConfig.

# TODO

 - Allow for each layer to specify the name of the geometry column to use for tiles
 - Allow to specify layer projection/srid and map projection/srid
 - Allow to specify quadtree configuration (max extent, mostly)
 - Link to a document describing "CartoCSS" version (ie: what's required for torque etc.)

# History

## 1.2.0

 - Add support for 'geom_type' and 'raster_band' in 'mapnik' type layers

## 1.1.0

 - Add support for 'torque' type layers
 - Add support for 'attributes' specification

## 1.0.1

 - Layer.options.interactivity became an array (from a string)

## 1.0.0

 - Initial version
