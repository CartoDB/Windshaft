'use strict';

const { promisify } = require('util');
const mapnik = require('@carto/mapnik');
const blend = promisify(mapnik.blend);
const Timer = require('../../stats/timer');

module.exports = class BlendRenderer {
    constructor (renderers) {
        this.renderers = renderers;
    }

    async getTile (format, z, x, y) {
        if (!this.renderers.length) {
            throw new Error('No renderers');
        }

        if (this.renderers.length === 1) {
            return this.renderers[0].getTile(format, z, x, y);
        }

        const timer = new Timer();

        timer.start('render');
        const data = await Promise.all(this.renderers.map(async renderer => {
            const { buffer, headers, stats } = await renderer.getTile(format, z, x, y);
            return { buffer, headers, stats, x: 0, y: 0, reencode: true };
        }));
        timer.end('render');

        if (!data) {
            throw new Error('No tiles to stitch.');
        }

        const extraStats = [];
        data.forEach(d => extraStats.push(d.stats));

        timer.start('encode');
        const buffer = await blend(data, { format: 'png', quality: null, width: 256, height: 256, reencode: true });
        timer.end('encode');

        return { buffer, headers: { 'Content-Type': 'image/png' }, stats: Object.assign(timer.getTimes(), { r: extraStats }) };
    }

    async close () {
        for (const renderer of this.renderers) {
            await renderer.close();
        }
    }

    getStats () {
        return this.renderers.reduce((accumulatedStats, renderer) => {
            const rendererStats = renderer.getStats();

            if (!(rendererStats instanceof Map)) {
                return accumulatedStats;
            }

            for (const [stat, value] of rendererStats) {
                if (accumulatedStats.has(stat)) {
                    accumulatedStats.set(stat, accumulatedStats.get(stat) + value);
                } else {
                    accumulatedStats.set(stat, value);
                }
            }

            return accumulatedStats;
        }, new Map());
    };
};
