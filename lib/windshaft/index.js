module.exports = {
    Server: require('./server'),
    Datasource: require('./models/datasource'),
    tilelive: require('tilelive'),
    grainstore: require('grainstore'),
    mapnik: require('mapnik'),
    stats: {
        Client: require('./stats/client'),
        Profiler: require('./stats/profiler_proxy')
    },
    model: {
        Datasource: require('./models/datasource'),
        MapConfig: require('./models/mapconfig')
    },
    storage: {
        MapStore: require('./storages/mapstore')
    },
    cache: {
        RendererCache: require('./cache/renderer_cache')
    },
    renderer: {
        Factory: require('./renderers/renderer_factory')
    },
    backend: {
        Attributes: require('./backends/attributes'),
        Map: require('./backends/map'),
        Preview: require('./backends/preview'),
        Tile: require('./backends/tile')
    },
    version: require('../../package.json').version
};
