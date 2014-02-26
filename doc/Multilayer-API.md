This document describes the API to manage and use windshaft layers.
The aim is to reduce the duplication of configuration among the multiple tiles and grids requests and at the same time to use a short url to fetch those subproduct of a "configured layer group".

# Intro

The API allows to create a new endpoint in the tiler which allow to retrieve tiles and interactivity grid for a group of layers defined by a SQL and a CartoCSS (among other options)

# quickstart

In order to create a new layergroup endpoint that servers the tiles for a map a layergroup needs to be sent to the server with a POST

A simple layergroup configuration looks like this (detailed layergroup configuration can be found in `layergroup api interface` section). With the configuration we create a [layergroup.json](MapConfig-specification) file. Example:
```json
{
  "version": "1.0.1",
  "layers": [{
    "type": "cartodb",
    "options": {
      "cartocss_version": "2.1.1", 
      "cartocss": "#layer { polygon-fill: #FFF; }",
      "sql": "select * from european_countries_e"
    }
  }]
}
```


the call would be (documentation should be replaced with the cartodb username):
```bash
curl 'http://documentation.cartodb.com/tiles/layergroup' -H 'Content-Type: application/json' -d @layergroup.json
```


it will return a json with the layergroup id and the timestamp of the last data modification:

```json
{
   "layergroupid":"c01a54877c62831bb51720263f91fb33:0",
   "last_updated":"1970-01-01T00:00:00.000Z"
}
```

With that ``layergroupid`` the url template to access the tiles can be created:

```
http://documentation.cartodb.com/tiles/layergroup/c01a54877c62831bb51720263f91fb33:0/{z}/{x}/{y}.png
```


# layergroup api interface
  - create a new layergroup
     should be a POST to /layergroup with the layergroup definition in the body (content-type application/json) or a GET from /layergroup with the [layergroup definition](MapConfig-specification) in a ``config`` parameter. For example:

```js
     {
version: '1.0.1',
extent: "-180,-90,180,90", //optional (currently unused)
maxzoom: 18, //optional (currently used to fetch test tile&grids)
minzoom:3, //optional (currently unused)
stat_tag: "string", // optional, for stats agregration -- **windshaft-cartodb extension**
global_cartocss:'#layer0{} #layer1{}...', // optional, takes precedence over per-layer setting
global_cartocss_version: '2.0.1', // optional, takes precedence over per-layer setting
// layers are defined in order to the first will be rendered first
layers: [
   {
     type: 'cartodb',
     options: {
       sql: 'select * from whatever',
       affected_tables: [ 'table1', 'schema.table2', '"MixedCase"."Table"' ], /* optional */
       cartocss: '#layer { ... }', /* global_cartocss takes precedence over this, if present */
       cartocss_version: '2.0.1', /* global_cartocss_version takes precedence over this, if present */
       interactivity: [ 'field1', ... ] 
     }
   }, 
   {
     // other layer definition
   }
]
     }
```

The tiler will create a _temporary_ mapnik configuration, assign it a token, try its validity (try to fetch a tile and a grid) and return the token. The _same_ configuration will result in the _same_ token. The client can use this token to fetch tiles or grids. There is no guarantee that the token remains alive so the client should be ready to catch 404 errors when accessing tiles.

The response will contain a timestamp corresponding to the most recent change in the data of any of the tables involved in any layer.

The response should be like this:

```
   {
      layergroupid: 'TOKEN',
      errors: [
          // sql errors (syntax errors)
          // cartodcss errors (syntax)
          // runtime errors (no permissions for the tables or the tiles can't be rendered)
      ]
      
   }
```

  - fetch tiles from it

```
  /layergroup/:TOKEN/:Z/:X/:Y.png
```

  - fetch grids from it

```
  /layergroup/:TOKEN/:LAYER/:Z/:X/:Y.grid.json
```

  - fetch attributes from it

```
  /layergroup/:TOKEN/:LAYER/attributes/:FID
```

grid.json tiles will contain the interactivity specified in the configuration for the given layer.
Layers are referenced by index (0..N). 
If no interactivity was specified for the given layer an error will be returned.


See [Windshaft-CartoDB extension](https://github.com/Vizzuality/Windshaft-cartodb/wiki/MultiLayer-API) to the API.

# tiler internals

## layergroups storage
they are temporary and stored within redis under grainstore responsibility

## cache management
they expire after some configured number of seconds since last access

## public private considerations
security will be left to postgresql layer and checked at get tile time

 
 
