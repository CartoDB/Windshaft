function TileliveAdaptor(renderer, format) {
    this.renderer = renderer;
    this.close = this.renderer.close.bind(this.renderer);
    this.get = function() { return renderer; };
    if ( format == 'png' ) {
        this.getTile = this.renderer.getTile.bind(this.renderer);
    }
    else if ( format == 'grid.json' ) {
        this.getTile = this.renderer.getGrid.bind(this.renderer);
    }
    else throw new Error("Unsupported format " + format);
}

module.exports = TileliveAdaptor;
