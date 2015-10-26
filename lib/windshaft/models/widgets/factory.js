var widgets = require('./');

function WidgetFactory() {
    this.widgets = Object.keys(widgets).reduce(function(allWidgets, widgetsClassName) {
        allWidgets[widgetsClassName.toLowerCase()] = widgets[widgetsClassName];
        return allWidgets;
    }, {});
}

module.exports = WidgetFactory;

WidgetFactory.prototype.getWidget = function(widgetDefinition, layerOptions) {
    var type = widgetDefinition.type;
    if (!this.widgets[type]) {
        throw new Error('Invalid widget type: "' + type + '"');
    }
    return new this.widgets[type](widgetDefinition.options, layerOptions);
};
