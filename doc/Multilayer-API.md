This document describes the API to manage and use windshaft layers.

The aim is to reduce the duplication of configuration among the multiple tiles
and grids requests and at the same time to use a short url to fetch those sub
products of a "configured layer group".


# Intro

The API allows to create a new endpoint in the tiler which allow to retrieve
tiles and interactivity grid for a group of layers defined by a SQL and a
CartoCSS (among other options).


# Quick start

In order to create a new layergroup endpoint that servers the tiles for a map
a layergroup needs to be sent to the server with a POST.

A simple layergroup configuration looks like this:

```json
{
    "version": "1.0.1",
    "layers": [
        {
            "type": "cartodb",
            "options": {
                "cartocss_version": "2.1.1",
                "cartocss": "#layer { polygon-fill: #FFF; }",
                "sql": "select * from european_countries_e"
            }
        }
    ]
}
```

With the configuration we create a `layergroup.json` file, that adheres to the
[MapConfig specification](MapConfig-specification.md).


The request would be (documentation should be replaced with the cartodb username):

```shell
curl 'http://documentation.cartodb.com/api/v1/map' \
    -H 'Content-Type: application/json' \
    -d @layergroup.json
```


It will return a JSON with the layergroup token id and the timestamp of the
last data modification:

```json
{
    "layergroupid": "c01a54877c62831bb51720263f91fb33:0",
    "last_updated": "1970-01-01T00:00:00.000Z"
}
```

With that `layergroupid` the url template to access the tiles can be created:

```
http://documentation.cartodb.com/api/v1/map/c01a54877c62831bb51720263f91fb33:0/{z}/{x}/{y}.png
```

# Configuration

The `base_url_mapconfig` configuration option will determine the endpoint for
the layergroup and the rest of the endpoints associated to the `layergroupid`.

In the previous quick start examples the `base_url_mapconfig` was configured
with the value `/api/v1/map`.


# Layergroup API
Routes considering the `base_url_mapconfig` configuration option, see previous
section for more information.

Note about layers: layers are zero-based indexed, so index for `N` layers will
go from `0` to `N-1`.


## Cross-origin resource sharing (CORS)
OPTIONS :base_url_mapconfig


## Create a layergroup
`GET :base_url_mapconfig` or `POST :base_url_mapconfig`

Should be a POST to `:base_url_mapconfig` with the layergroup definition in the
body (content-type application/json) or a GET from `:base_url_mapconfig` with
the [layergroup definition](MapConfig-specification.md) in a `config` parameter.

For example:

```json
{
    "version": "1.0.1",
    "layers": [
        {
            "type": "cartodb",
            "options": {
                "cartocss_version": "2.1.1",
                "cartocss": "#layer { polygon-fill: #FFF; }",
                "sql": "select * from european_countries_e"
            }
        }
    ]
}
```

The tiler will create a _temporary_ mapnik configuration, assign it a token,
try its validity (try to fetch a tile and a grid) and return the token. The
_same_ configuration will result in the _same_ token. The client can use this
token to fetch tiles or grids. There is no guarantee that the token remains
alive so the client should be ready to catch 404 errors when accessing tiles.

The response will contain a timestamp corresponding to the most recent change
in the data of any of the tables involved in any layer.

The response should be like:

```
{
    // {String} The layergroup identifier that allows to request resources
    "layergroupid": ":TOKEN",
    // {Object} Metadata associated to the layergroup
    "metadata": {
        // {Array} a list of metadata for each layer
        "layers": [
            {
                // mandatory
                // {String} the type of the renderer, as in a layergroup
                // Valid types in Windshaft: "mapnik", "torque", "http", "plain"
                "type": "mapnik",
                // mandatory
                // {Object} it will be always present, even if empty
                "meta": {
                    // as many JSON valid key => value pairs
                    // what you might find here is renderer-specific
                }
            }
        ],
        // torque metadata in case there is at least one torque layer
        "torque": {
            // the index of the torque layer inside the layergroup
            "1": {
                // {Number} min value for time column (in millis for time columns of date type)
                "start": 1325372640000,
                // {Number} max value for time column (in millis). Must be greater or equal than start
                "end": 1356994560000,
                // {Number} number of aggregated data steps
                "data_steps": 145571,
                // {String} time column type, can be "date" or "number"
                "column_type": "date"
            }
        }
    }
}
```

In case of error it will be like:

```json
{
    "errors": [
        "sql errors (syntax errors)",
        "cartodcss errors (syntax)",
        "runtime errors (no permissions)"
    ]
}
```


## Fetch tiles

`GET :base_url_mapconfig/:TOKEN/{z}/{x}/{y}.png` or
`GET :base_url_mapconfig/:TOKEN/{z}/{x}/{y}@{resolution}x.png` or
`GET :base_url_mapconfig/:TOKEN/:LAYER/{z}/{x}/{y}.png` (for backward
compatibility).

Will render all `cartodb`/`mapnik` layers together in the specified order,
layer blending will happen based on the cartocss.

### Retina support

The `@{resolution}x` option will render the image for retina displays, by
default it supports resolution={1,2}, with `@2x` the image will be 512x512
pixels instead of 256x256 pixels.


## Fetch *tiles* for a layer
`GET :base_url_mapconfig/:TOKEN/:LAYER/{z}/{x}/{y}.{format}`

Where `{format}` could be:

  - png
  - grid.json
  - torque.json, torque.bin

Currently the specified `:LAYER` must support the requested `{format}`, so if
you request a `torque.json` as `format` the `:LAYER` should be defined as a
torque layer type.

### grid.json example

`GET :base_url_mapconfig/:TOKEN/:LAYER/{z}/{x}/{y}.grid.json`


## Fetch tiles for a group of (blended) layers

`GET :base_url_mapconfig/:TOKEN/:LAYER_FILTER/{z}/{x}/{y}.png`

`:LAYER_FILTER` supports two formats:

 - **all**: it will blend all layers in the layergroup.
 Example: `GET :base_url_mapconfig/:TOKEN/all/{z}/{x}/{y}.png`
 - **filtering by layer index** using commas: something like `0,3,4` will filter and blend layers 0,3,4.
 Example: `GET :base_url_mapconfig/:TOKEN/0,3,4/{z}/{x}/{y}.png`
 Some notes about filtering:
  * Invalid index values or out of bound indexes will end in `Invalid layer filtering` errors.
  * Ordering is not considered. So right now filtering layers 0,3,4 is the very same thing as filtering 3,4,0. As this
  may change in the future **it is recommended** to always select the layers in ascending order so you will get a
  consistent behaviour in the future.

**Important**: currently format is limited to `png`. That means that all renderers in the layergroup must support that
format to be able to blend them.


## Fetch static preview

### By center + zoom + image dimensions
`GET :base_url_mapconfig/static/center/:TOKEN/:Z/:LAT/:LNG/:WIDTH/:HEIGHT.:format`

### By bounding box + image dimensions
`GET :base_url_mapconfig/static/bbox/:TOKEN/:WEST,:SOUTH,:EAST,:NORTH/:WIDTH/:HEIGHT.:format`


## Fetch attributes

`GET :base_url_mapconfig/:TOKEN/:LAYER/attributes/:FID`

grid.json tiles will contain the interactivity specified in the configuration for the given layer.

If no interactivity was specified for the given layer an error will be returned.


See [Windshaft-cartodb extension](https://github.com/CartoDB/Windshaft-cartodb/blob/master/docs/MultiLayer-API.md) to the API.


# Internals

## Layergroups storage
They are temporary and stored within redis under grainstore responsibility

## Cache management
They expire after some configured number of seconds since last access

## Public vs Private considerations
Security will be left to postgresql layer and checked at get tile time
