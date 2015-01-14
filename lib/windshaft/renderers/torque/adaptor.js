function TorqueAdaptor(renderer) {
    this.renderer = renderer;
    this.close = function() { /* nothing to do */ };
    this.get = function() { return renderer; };
    this.getTile = this.renderer.getTile.bind(this.renderer);
}

module.exports = TorqueAdaptor;
