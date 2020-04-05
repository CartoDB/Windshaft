Renderer interface
------------------

Renderers are a high level abstraction over lower level rendering functions.
 - Unify tile requests over one simple interface
 - Created through renderer factories

# Renderer

Renderers are expected to expose the following interfaces:

## getTile(format, z, x, y)

Get a tile given ZXY params

```javascript
async getTile(format, z, x, y)
```
- @param `{String} format` the format/encoding to render
- @param `{Number} z` zoom level
- @param `{Number} x`
- @param `{Number} y`
- @returns `{Promise.<(Object|Error)>}` where:
  - `{Object}`:
    - `{Buffer} tile` will be an opaque object
    - `{Object} headers` will contain info about `tileObj`, like mime-type of the tile 'image/png'
    - `{Object} stats` an object with query, render, encode times
  - `{Error}`: will be an instance of Error on any problem

## getMetadata()

Get metadata information about the tile set

```javascript
async getMetadata()
```
- @returns `{Promise.<(Object|Error)>}` where:
  - `{Object} meta` Format of the 'meta' object is renderer-specific, see renderer documentation for that
  - `{Error} err` for any problem, or null

## getStats()

Get information about the renderer's performance

```javascript
getStats()
```
- @returns `{Map.<key{string}|value{integer}>}` where:
  - `key`: the stat to report, for instance: `pool.waiting`, `cache.png`, etc..
  - `value`: the current value of the stat

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

## getAdaptor(renderer, onTileErrorStrategy)

Returns an renderer adaptor

```javascript
getAdaptor(renderer, onTileErrorStrategy)
```
 - @param `{Renderer} renderer` A raw renderer
 - @param `{Function} onTileErrorStrategy` An optional function that will handle the error case
 - @return `{Adaptor}` An adapted renderer
