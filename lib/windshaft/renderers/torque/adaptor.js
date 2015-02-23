function Adaptor(renderer) {
    this.renderer = renderer;
    this.getTile = this.renderer.getTile.bind(this.renderer);
    this.get = function() {
        return renderer;
    };
    this.close = function() {
        // it only applies to Torque PNG renderer
        if (renderer.endWorkerFarm) {
            renderer.endWorkerFarm();
        }
    };
}

module.exports = Adaptor;
