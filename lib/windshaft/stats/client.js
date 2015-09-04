var _ = require('underscore');
var debug = require('debug')('windshaft:stats_client');
var StatsD = require('node-statsd').StatsD;

module.exports = {
    /**
     * Returns an StatsD instance or an stub object that replicates the StatsD public interface so there is no need to
     * keep checking if the stats_client is instantiated or not.
     *
     * The first call to this method implies all future calls will use the config specified in the very first call.
     *
     * TODO: It's far from ideal to use make this a singleton, improvement desired.
     * We proceed this way to be able to use StatsD from several places sharing one single StatsD instance.
     *
     * @param config Configuration for StatsD, if undefined it will return an stub
     * @returns {StatsD|Object}
     */
    getInstance: function(config) {

        if (!this.instance) {

            var instance;

            if (config) {
                instance = new StatsD(config);
                instance.last_error = { msg: '', count: 0 };
                instance.socket.on('error', function (err) {
                    var last_err = instance.last_error;
                    var last_msg = last_err.msg;
                    var this_msg = '' + err;
                    if (this_msg !== last_msg) {
                        debug("statsd client socket error: " + err);
                        instance.last_error.count = 1;
                        instance.last_error.msg = this_msg;
                    } else {
                        ++last_err.count;
                        if (!last_err.interval) {
                            instance.last_error.interval = setInterval(function () {
                                var count = instance.last_error.count;
                                if (count > 1) {
                                    debug("last statsd client socket error repeated " + count + " times");
                                    instance.last_error.count = 1;
                                    //console.log("Clearing interval");
                                    clearInterval(instance.last_error.interval);
                                    instance.last_error.interval = null;
                                }
                            }, 1000);
                        }
                    }
                });
            } else {
                var stubFunc = function (stat, value, sampleRate, callback) {
                    if (_.isFunction(callback)) {
                        callback(null, 0);
                    }
                };
                instance = {
                    timing: stubFunc,
                    increment: stubFunc,
                    decrement: stubFunc,
                    gauge: stubFunc,
                    unique: stubFunc,
                    set: stubFunc,
                    sendAll: stubFunc,
                    send: stubFunc
                };
            }

            this.instance = instance;
        }

        return this.instance;
    }
};