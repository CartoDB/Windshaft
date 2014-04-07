function CacheEntry()
{
    this.ready = false;
    this.err = null;
    this.renderer = null;
    this.ctime = this.atime = Date.now(); // last access time
    this.cb = [];
    this._refcount = 0;
    this.id = ('' + Math.random()).substr(5, 4); // this is for debugging only
    /*
     console.log("CacheEntry " + this.id + " created");
     */
}

CacheEntry.prototype = Object.create(require('events').EventEmitter.prototype);

CacheEntry.prototype.pushCallback = function(cb) {
    this._addRef();
    if ( this.ready ) {
        cb(this.err, this, true);
        this.setLastUsed(Date.now()); // update last access time;
    } else {
        this.cb.push(cb);
    }
};

// Get one tile from the service
CacheEntry.prototype.getTile = function(z, x, y, cb) {
    this.renderer.getTile.apply(this.renderer, arguments); // z, x, y, cb);
};

// Get the contained entry
CacheEntry.prototype.get = function() {
    return this.renderer.get();
};

CacheEntry.prototype.setReady = function(err, renderer) {
    // consistency check
    if ( this.ready ) throw new Error("Invalid call to CacheEntry.setReady on an ready entry");
    this.ready = true;
    this.err = err;
    this.renderer = renderer;

    var cached = false;
    var cb;
    while (cb = this.cb.shift()) {
        cb(err, this, cached);
        cached = true;
    }

    // TODO: update last access time here ?
    this.emit('ready', this);

    if ( err ) this.emit('error', err);
};

// Call this as soon as you get a reference to the object
// if you plan to use it for longer than the current tick.
// Call dropRef when finished with it.
CacheEntry.prototype._addRef = function() {
    ++this._refcount;
};

CacheEntry.prototype.release = function() {
    this._dropRef();
};

CacheEntry.prototype._dropRef = function() {
    if ( ! --this._refcount ) {
        this._destroy();
    }
};

CacheEntry.prototype.setLastUsed = function(t) {
    this.atime = t;
};

CacheEntry.prototype.timeSinceLastAccess = function(now) {
    var age = ( now - this.atime );
    return age;
};

// Destroy (now or ASAP) a CacheEntry
//
// TODO: accept a callback ?
//
CacheEntry.prototype._destroy = function() {

    // integrity checks
    if ( this.cb.length ) throw new Error("CacheEntry._destroy was called while still having " + this.cb.length + " callbacks pending");
    if ( this._refcount ) throw new Error("CacheEntry._destroy was called while still having " + this._refcount + " references");

    if ( ! this.ready ) {
        // not ready yet, try later
        //console.log("cache_entry " + this.id + " isn't ready yet, scheduling destruction on 'ready' event");
        this.on('ready', this._destroy.bind(this));
    }
    else if ( ! this.renderer ) {
        // nothing to do
        //console.log("This cache entry is ready but has no renderer, so nothing to do");
    }
    else {
        //console.log("Calling .close on cache_entry " + this.id);
        // TODO: fixme: we can't modify the renderer here because
        //       tilelive-mapnik is keeping an internal cache and
        //       so modifying an object we'd be modifying something
        //       which will possibly be reused later.
        //       See https://github.com/mapbox/tilelive-mapnik/issues/47
        //
        //this.renderer._pool.destroyAllNow();
        this.renderer.close(function() {}); // TODO: accept a callback ?
    }
};

module.exports = CacheEntry;
