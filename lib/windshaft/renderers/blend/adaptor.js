function BlendAdaptor(renderer) {
    this.renderer = renderer;
    this.close = function() { };
    this.get = function() { return renderer; };
    this.getTile = this.renderer.getTile.bind(this.renderer);
}

module.exports = BlendAdaptor;
