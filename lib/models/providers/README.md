MapConfigProvider interface
---------------------------

MapConfigProviders help to manipulate MapConfig models within a RendererCache:
 - Load a MapConfig
 - Get its key for the cache
 - Get its cache buster to know when it's required to reload the model

# MapConfigProvider

MapConfigProviders are expected to expose the following interface:

## getMapConfig(callback)

Get a MapConfig model with associated params and context to create a Renderer.

```javascript
getMapConfig(callback)
```
 - @param `{Function} callback` function(err, mapConfig, params, context)
   * `{Error} err` will be an instance of Error on any problem, or null
   * `{MapConfig} mapConfig` will be an opaque object
   * `{Object} params` will contain params associated to the MapConfig request, like format, layer, and so.
   * `{Object} context` an object with information for renderers like query limits, etc.

## getKey()

Returns the key for the MapConfig model plus its params. It will be used by RendererCache to store the renderer
associated to the MapConfig.

```javascript
getKey()
```
 - @return `{String}` the key for the Renderer

## getCacheBuster()

Returns a number representing the last modification time of the MapConfig so it's possible to know whether a Renderer
must be recreated or not.

```javascript
getKey()
```
 - @return `{Number}` the last modified time for the MapConfig, aka buster
