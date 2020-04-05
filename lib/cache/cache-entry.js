'use strict';

const debug = require('debug')('windshaft:cache-entry');

function CacheEntry (cacheBuster, key = 'key-not-provided') {
    this.ready = false;
    this.err = null;
    this.renderer = null;
    this.ctime = this.atime = Date.now(); // last access time
    this.cb = [];
    this._refcount = 0;
    this.cacheBuster = cacheBuster;
    this.key = key;
}

CacheEntry.prototype = Object.create(require('events').EventEmitter.prototype);

CacheEntry.prototype.pushCallback = function (cb) {
    this._addRef();
    if (this.ready) {
        cb(this.err, this, true);
        this.setLastUsed(Date.now()); // update last access time;
    } else {
        this.cb.push(cb);
    }
};

// Get one tile from the service
CacheEntry.prototype.getTile = async function (format, z, x, y) {
    return this.renderer.getTile(format, z, x, y);
};

CacheEntry.prototype.getMetadata = async function () {
    return this.renderer.getMetadata();
};

// Get the contained entry
CacheEntry.prototype.get = function () {
    return this.renderer.get();
};

CacheEntry.prototype.setReady = function (err, renderer) {
    // consistency check
    if (this.ready) {
        debug('Invalid call to CacheEntry.setReady on an ready entry');
        return;
    }

    this.ready = true;
    this.err = err;
    this.renderer = renderer;

    var cached = false;
    var cb = this.cb.shift();
    while (cb) {
        cb(err, this, cached);
        cached = true;
        cb = this.cb.shift();
    }

    // TODO: update last access time here ?
    this.emit('ready', this);

    if (err) {
        this.emit('error', err);
    }
};

// Call this as soon as you get a reference to the object
// if you plan to use it for longer than the current tick.
// Call dropRef when finished with it.
CacheEntry.prototype._addRef = function () {
    ++this._refcount;
};

CacheEntry.prototype.release = function () {
    this._dropRef();
};

CacheEntry.prototype._dropRef = function () {
    if (!--this._refcount) {
        this._destroy();
    }
};

CacheEntry.prototype.setLastUsed = function (t) {
    this.atime = t;
};

CacheEntry.prototype.timeSinceLastAccess = function (now) {
    return now - this.atime;
};

// Destroy (now or ASAP) a CacheEntry
//
// TODO: accept a callback ?
//
CacheEntry.prototype._destroy = function () {
    if (this.cb.length) {
        debug(`CacheEntry._destroy was called while still having ${this.cb.length} callbacks pending`);
        return;
    }

    if (this._refcount) {
        debug(`CacheEntry._destroy was called while still having ${this._refcount} references`);
        return;
    }

    if (!this.ready) {
        // not ready yet, try later
        debug(`cache_entry ${this.key} isn't ready yet, scheduling destruction on 'ready' event`);
        this.on('ready', this._destroy.bind(this));
        return;
    }

    if (!this.renderer) {
        debug(`Cache entry ${this.key} is ready but has no renderer, so nothing to do`);
        return;
    }

    // TODO: fixme: we can't modify the renderer here because
    //       tilelive-mapnik is keeping an internal cache and
    //       so modifying an object we'd be modifying something
    //       which will possibly be reused later.
    //       See https://github.com/mapbox/tilelive-mapnik/issues/47
    this.renderer.close(() => {
        debug(`Mapnik Renderer ${this.key} closed due to its cache entry was released and it doesn't have references`);
    });
};

module.exports = CacheEntry;
