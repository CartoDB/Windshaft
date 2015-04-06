/**
 * Base adaptor
 * Wraps any renderer that does not require adapting its interface
 * @param {Object} renderer
 * @param {String} format
 * @param {Function} onTileErrorStrategy optional function that will be called in case of error when requesting a tile
 * @constructor
 */
function BaseAdaptor(renderer, format, onTileErrorStrategy) {
    this.renderer = renderer;
    if (onTileErrorStrategy) {
        this.getTile = function(z, x, y, callback) {
            renderer.getTile(z, x, y, function(err, tile, headers, stats) {
                if (err) {
                    return onTileErrorStrategy(err, tile, headers, stats, format, callback);
                } else {
                    return callback(err, tile, headers, stats);
                }
            });
        };
    } else {
        this.getTile = this.renderer.getTile.bind(this.renderer);
    }
    this.get = function() {
        return renderer;
    };
    this.close = function() {};
}

module.exports = BaseAdaptor;
