Renderer interface
------------------

Renderers are a high level abstraction over lower level rendering functions.
 - Unify tile requests over one simple interface
 - Created through renderer factories

# Renderer

Renderers are expected to expose the following interfaces:

## getTile(z, x, y, options, callback)

Get a tile given ZXY params

```javascript
getTile(z, x, y, options, callback)
```
 - @param `{Number} z` zoom level
 - @param `{Number} x`
 - @param `{Number} y`
 - @param `{Object} options`
   * `{String} requestId` cross identifier to log render queries
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

## getRenderer(mapConfig, format, options, callback)

Create a renderer given a map and data store configuration

```javascript
getRenderer(mapConfig, format, options, callback)
```
 - @param `{MapConfig} mapConfig` map configuration, see [specification](../../../doc/MapConfig-specification.md)
 - @param `{String} format` output format for the tile
 - @param `{Object} options` will include extra configuration like db connection params, layer to render, limits
 - @param `{Function} callback` function(err, renderer)
   * `{Error} err` in case of problems, or null
   * `{Renderer} renderer` the renderer

## supportsFormat(format)

Returns an array of formats supported by the factory/renderer

```javascript
getSupportedFormats()
```
 - @param `{String} format` The format extension
 - @return `{Boolean}` Whether the factory supports the format to create a renderer

## getName()

Returns a string with the name for the factory

```javascript
getName()
```
 - @return `{String}` the name of the factory

## getAdaptor(renderer, format, onTileErrorStrategy)

Returns an renderer adaptor

```javascript
getAdaptor(renderer, format, onTileErrorStrategy)
```
 - @param `{Renderer} renderer` A raw renderer
 - @param `{String} format` The format extension
 - @param `{Function} onTileErrorStrategy` An optional function that will handle the error case
 - @return `{Adaptor}` An adapted renderer
