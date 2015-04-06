function TileliveAdaptor(renderer, format, onTileErrorStrategy) {
    this.renderer = renderer;
    this.close = this.renderer.close.bind(this.renderer);
    this.get = function() { return renderer; };
    if ( format === 'png' ) {
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
    } else if ( format === 'grid.json' ) {
        this.getTile = this.renderer.getGrid.bind(this.renderer);
    } else {
        throw new Error("Unsupported format " + format);
    }
}

module.exports = TileliveAdaptor;
