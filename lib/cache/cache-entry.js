'use strict';

const debug = require('debug')('windshaft:cache-entry');
const { EventEmitter } = require('events');

module.exports = class CacheEntry extends EventEmitter {
    constructor (cacheBuster, key = 'key-not-provided') {
        super();
        this.ready = false;
        this.err = null;
        this.renderer = null;
        this.ctime = this.atime = Date.now(); // last access time
        this.cb = [];
        this._refcount = 0;
        this.cacheBuster = cacheBuster;
        this.key = key;
    }

    pushCallback (callback) {
        this._addRef();
        if (this.ready) {
            callback(this.err, this, true);
            this.setLastUsed(Date.now()); // update last access time;
        } else {
            this.cb.push(callback);
        }
    }

    // Get one tile from the service
    async getTile (format, z, x, y) {
        return this.renderer.getTile(format, z, x, y);
    }

    async getMetadata () {
        return this.renderer.getMetadata();
    }

    // Get the contained entry
    get () {
        return this.renderer.get();
    }

    setReady (err, renderer) {
        // consistency check
        if (this.ready) {
            debug('Invalid call to CacheEntry.setReady on an ready entry');
            return;
        }

        this.ready = true;
        this.err = err;
        this.renderer = renderer;

        let cached = false;
        let callback = this.cb.shift();
        while (callback) {
            callback(err, this, cached);
            cached = true;
            callback = this.cb.shift();
        }

        // TODO: update last access time here ?
        this.emit('ready', this);

        if (err) {
            this.emit('error', err);
        }
    }

    // Call this as soon as you get a reference to the object
    // if you plan to use it for longer than the current tick.
    // Call dropRef when finished with it.
    _addRef () {
        ++this._refcount;
    }

    release () {
        this._dropRef();
    }

    _dropRef () {
        if (!--this._refcount) {
            this._destroy();
        }
    }

    setLastUsed (t) {
        this.atime = t;
    }

    timeSinceLastAccess (now) {
        return now - this.atime;
    }

    // Destroy (now or ASAP) a CacheEntry
    //
    // TODO: accept a callback ?
    //
    _destroy () {
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
    }
};
