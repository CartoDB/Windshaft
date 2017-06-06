var mapnik = require('mapnik');

var MapnikTimer = {
    flush: function flush() {
        return mapnik.TimerStats.flush();
    }
};

module.exports = MapnikTimer;
