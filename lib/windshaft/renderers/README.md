Renderer interface
------------------

Renderers are a high level abstraction over lower level rendering functions.
 - Unify tile requests over one simple interface
 - Created through renderer factories

# Renderer

Renderers are expected to expose the following interfaces:

## getTile(z, x, y, callback)

Get a tile given ZXY params

```javascript
getTile(z, x, y, callback)
```
 - @param `{Number} z` zoom level
 - @param `{Number} x`
 - @param `{Number} y`
 - @param `{Function} callback` function(err, tileObj, meta, stats)
   * `{Error} err` will be an instance of Error on any problem, or null
   * `{Object} tileObj` will be an opaque object
   * `{Object} meta` will contain info about `tileObj`, like mime-type of the tile 'image/png'
   * `{Object} stats` an object with query, render, encode times

## getMetadata(callback)

Get metadata information about the tile set

```javascript
getMetadata(callback)
```
 - @param `{Function} callback` function(err, meta)
   * `{Error} err` for any problem, or null
   * `{Object} meta` Format of the 'meta' object is renderer-specific, see renderer documentation for that.

# Factory

Renderer factories are expected to expose the following interface:

## getRenderer(mapConfig, params, format, layerNumber, callback)

Create a renderer given a map and data store configuration

```javascript
getRenderer(mapConfig, params, format, layerNumber, callback)
```
 - @param `{MapConfig} mapConfig` map configuration, see [specification](../../../doc/MapConfig-specification.md)
 - @param `{Object} params` datastore configuration, with supported members: user, pass, host, port, dbname
 - @param `{String} format` output format for the tile
 - @param `{Number} layer` layer number within the mapConfig
 - @param `{Function} callback` function(err, renderer)
   * `{Error} err` in case of problems, or null
   * `{Renderer} renderer` the renderer
