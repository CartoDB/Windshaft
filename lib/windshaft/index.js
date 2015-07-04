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
        Map: require('./backends/map'),
        StaticMap: require('./backends/static_map')
    },
    version: require('../../package.json').version
};
