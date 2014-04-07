/**
 * Periodical runner that purges localized resources from the provided MMLStore.
 *
 * @param {MMLStore} mml_store the MMLStore instance
 * @param {Number} ttl time to live in second for localized resources
 */
var LocalizedResourcePurger = function(mml_store, ttl) {
    this.mml_store = mml_store;
    this.ttl = ttl;
};
LocalizedResourcePurger.runCount = 0;
LocalizedResourcePurger.running = false;
LocalizedResourcePurger.prototype = {
    purger: function() {
        if ( ! LocalizedResourcePurger.running ) {
            LocalizedResourcePurger.running = true;
            var id = 'GC' + (++LocalizedResourcePurger.runCount);
            console.log(id + ": purger start");
            this.mml_store.purgeLocalizedResources(this.ttl, function(err) {
                if ( err ) {
                    console.error("purging localized resources: " + err);
                }
                console.log(id + ": purger completed");
                LocalizedResourcePurger.running = false;
            }, id);
        }
        else {
            var id = 'GC' + (LocalizedResourcePurger.runCount);
            console.log(id + ": purger already running");
        }
    },
    start: function() {
        if ( ! this.interval )
            this.interval = setInterval(this.purger.bind(this), this.ttl*1000);
    },
    stop: function() {
        clearInterval(this.interval);
        delete this.interval;
    }
};

module.exports = LocalizedResourcePurger;