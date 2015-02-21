/**
 * Base adaptor
 * Wraps any renderer that does not require adapting its interface
 * @param renderer
 * @constructor
 */
function BaseAdaptor(renderer) {
    this.renderer = renderer;
}

module.exports = BaseAdaptor;


BaseAdaptor.prototype.get = function() {
    return this.renderer;
};

BaseAdaptor.prototype.getTile = function() {
    this.renderer.getTile.apply(this.renderer, arguments);
};

BaseAdaptor.prototype.close = function() {};
