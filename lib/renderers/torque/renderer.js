'use strict';

const format = require('../../utils/format');
const Timer = require('../../stats/timer');
const debug = require('debug')('windshaft:renderer:torque');
const SubstitutionTokens = require('cartodb-query-tables').utils.substitutionTokens;
const { promisify } = require('util');

module.exports = class TorqueRenderer {
    constructor (layer, sql, attrs, options) {
        options = options || {};

        this.sql = promisify(sql);
        this.attrs = attrs;
        this.layer = layer;

        this.tile_size = options.tileSize || 256;
        this.tile_max_geosize = options.maxGeosize || 40075017; // earth circumference in webmercator 3857
        this.buffer_size = options.bufferSize || 0;
        this.tile_sql = options.tile_sql || defaultTileSQLTemplate();
    }

    async getTile (format, z, x, y) {
        const { buffer, headers, stats } = await this.getTileData(this.sql, { x: x, y: y }, z, this.layer.options.sql, this.attrs);
        return { buffer, headers, stats };
    }

    // API: returns metadata for this renderer
    //
    // Metadata for a torque layer is an object
    // with the following elements:
    //   - start  ??
    //   - end    ??
    //   - data_steps ??
    //   - column_type ??
    //
    // TODO: document the meaning of each !
    async getMetadata () {
        const a = this.attrs;
        const meta = {
            start: a.start * 1000,
            end: a.end * 1000,
            steps: +a.steps,
            data_steps: a.data_steps >> 0,
            column_type: a.is_time ? 'date' : 'number'
        };
        return meta;
    }

    async getTileData (sql, coord, zoom, layerSql, attrs) {
        let columnConv = attrs.column;

        if (attrs.is_time) {
            columnConv = format("date_part('epoch', {column})", attrs);
        }

        const tileSize = this.tile_size;
        const bufferSize = this.buffer_size;
        const tileMaxGeosize = this.tile_max_geosize;
        const geomColumn = this.layer.options.geom_column || 'the_geom_webmercator';
        const geomColumnSrid = this.layer.options.srid || 3857;

        function cdbXYZResolution (z) {
            const fullResolution = tileMaxGeosize / tileSize;
            return fullResolution / Math.pow(2, z);
        }

        function cdbXYZExtent (x, y, z) {
            const initialResolution = cdbXYZResolution(0);
            const originShift = (initialResolution * tileSize) / 2.0;

            const pixres = initialResolution / Math.pow(2, z);
            const tileGeoSize = tileSize * pixres;

            const buffer = bufferSize / 2;

            const xmin = -originShift + x * tileGeoSize;
            const xmax = -originShift + (x + 1) * tileGeoSize;

            // tile coordinate system is y-reversed so ymin is the top of the tile
            const ymin = originShift - y * tileGeoSize;
            const ymax = originShift - (y + 1) * tileGeoSize;

            return {
                xmin: xmin,
                ymin: ymin,
                xmax: xmax,
                ymax: ymax,
                b_xmin: xmin - (pixres * buffer),
                b_ymin: ymin + (pixres * buffer),
                b_xmax: xmax + (pixres * buffer),
                b_ymax: ymax - (pixres * buffer),
                b_size: buffer / attrs.resolution
            };
        }

        const extent = cdbXYZExtent(coord.x, coord.y, zoom);
        const xyzResolution = cdbXYZResolution(zoom);

        layerSql = SubstitutionTokens.replace(layerSql, {
            bbox: format('ST_MakeEnvelope({xmin},{ymin},{xmax},{ymax},{srid})', { srid: geomColumnSrid }, extent),
            // See https://github.com/mapnik/mapnik/wiki/ScaleAndPpi#scale-denominator
            scale_denominator: xyzResolution / 0.00028,
            pixel_width: xyzResolution,
            pixel_height: xyzResolution
        });

        const query = format(this.tile_sql, { _sql: layerSql }, { _stepFilter: stepFilter(attrs) }, attrs, {
            zoom: zoom,
            x: coord.x,
            y: coord.y,
            column_conv: columnConv,
            xyz_resolution: xyzResolution,
            srid: geomColumnSrid,
            gcol: geomColumn
        }, extent);

        try {
            const timer = new Timer();

            timer.start('query');
            const data = await sql(query);
            timer.end('query');

            return { buffer: data.rows, headers: { 'Content-Type': 'application/json' }, stats: timer.getTimes() };
        } catch (err) {
            debug(`Error running torque query "${query}": ${err}`);

            if (err.message) {
                err.message = 'TorqueRenderer: ' + err.message;
            }

            throw err;
        }
    }
};

function stepFilter (attrs) {
    let sqlCondition = '';

    if (attrs.stepSelect !== undefined) {
        sqlCondition = 'AND floor(({column_conv} - {start})/{step}) ' +
            'BETWEEN {stepSelect} - {stepOffset} + 1 AND {stepSelect} ';
    }

    return sqlCondition;
}

function defaultTileSQLTemplate () {
    return `
        WITH par AS (
            WITH innerpar AS (
                SELECT
                    1.0/(({xyz_resolution})*{resolution}) as resinv,
                    ST_MakeEnvelope({b_xmin}, {b_ymin}, {b_xmax}, {b_ymax}, {srid}) as b_ext,
                    ST_MakeEnvelope({xmin}, {ymin}, {xmax}, {ymax}, {srid}) as ext
            )
            SELECT
                ({xyz_resolution})*{resolution} as res,
                innerpar.resinv as resinv,
                innerpar.b_ext as b_ext,
                st_xmin(innerpar.ext) as xmin,
                st_ymin(innerpar.ext) as ymin,
                round((st_xmax(innerpar.ext) - st_xmin(innerpar.ext))*innerpar.resinv) - 1 as maxx,
                round((st_ymax(innerpar.ext) - st_ymin(innerpar.ext))*innerpar.resinv) - 1 as maxy
            FROM innerpar
        )
        SELECT xx x__uint8,
            yy y__uint8,
            array_agg(c) vals__uint8,
            array_agg(d) dates__uint16
        FROM (
            select
                GREATEST(0 - {b_size}, LEAST(p.maxx + {b_size}, round((st_x(i.{gcol}) - p.xmin)*resinv))) as xx,
                GREATEST(0 - {b_size}, LEAST(p.maxy + {b_size}, round((st_y(i.{gcol}) - p.ymin)*resinv))) as yy,
                {countby} c,
                floor(({column_conv} - {start})/{step}) d
            FROM ({_sql}) i, par p
            WHERE i.{gcol} && p.b_ext {_stepFilter}
            GROUP BY xx, yy, d
        ) cte, par
        GROUP BY x__uint8, y__uint8
    `;
}
