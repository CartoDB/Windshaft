MapConfigProvider interface
---------------------------

MapConfigProviders help to manipulate MapConfig models within a RendererCache:
 - Load a MapConfig
 - Get its key for the cache
 - Get its cache buster to know when it's required to reload the model

# MapConfigProvider

MapConfigProviders are expected to expose the following interface:

## getMapConfig(callback)

TBA

## getKey()

TBA

## getCacheBuster()

TBA