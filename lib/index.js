'use strict';

const MapConfig = require('./models/mapconfig');
const Datasource = require('./models/datasource');
const MapStore = require('./storages/mapstore');
const RendererCache = require('./cache/renderer-cache');
const TileBackend = require('./backends/tile');
const AttributesBackend = require('./backends/attributes');
const PreviewBackend = require('./backends/preview');
const MapValidator = require('./backends/map-validator');
const MapBackend = require('./backends/map');
const RendererFactory = require('./renderers/renderer-factory');

function windshaftFactory ({ rendererOptions, redisPool, onTileErrorStrategy, logger }) {
    const mapStore = new MapStore({
        pool: redisPool,
        expire_time: rendererOptions.grainstore.default_layergroup_ttl,
        logger
    });

    const rendererFactory = new RendererFactory({
        onTileErrorStrategy: onTileErrorStrategy,
        mapnik: {
            grainstore: rendererOptions.grainstore,
            mapnik: rendererOptions.renderer.mapnik
        },
        http: rendererOptions.renderer.http,
        mvt: rendererOptions.renderer.mvt,
        torque: rendererOptions.renderer.torque
    });

    const rendererCache = new RendererCache(rendererFactory, rendererOptions.renderCache);
    const tileBackend = new TileBackend(rendererCache);
    const attributesBackend = new AttributesBackend();
    const concurrency = rendererOptions.renderer.mapnik.poolSize +
                        rendererOptions.renderer.mapnik.poolMaxWaitingClients;
    const previewBackend = new PreviewBackend(rendererCache, { concurrency });
    const mapValidator = new MapValidator(tileBackend, attributesBackend);
    const mapBackend = new MapBackend(rendererCache, mapStore, mapValidator);

    return {
        rendererCache,
        mapBackend,
        tileBackend,
        attributesBackend,
        previewBackend,
        mapStore
    };
};

module.exports = {
    factory: windshaftFactory,
    model: { MapConfig, Datasource }
};
