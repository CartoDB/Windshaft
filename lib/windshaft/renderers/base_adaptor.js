/**
 * Base adaptor
 * Wraps any renderer that does not require adapting its interface
 * @param renderer
 * @constructor
 */
function BaseAdaptor(renderer) {
    this.renderer = renderer;
    this.getTile = this.renderer.getTile.bind(this.renderer);
    this.get = function() {
        return renderer;
    };
    this.close = function() {};
}

module.exports = BaseAdaptor;
