// Cribbed from the ever prolific Konstantin Kaefer
// https://github.com/mapbox/tilelive-mapnik/blob/master/test/support/assert.js

var fs = require('fs');
var http = require('http');
var path = require('path');
var exec = require('child_process').exec;

var assert = module.exports = exports = require('assert');

//
// @param tol tolerated color distance as a percent over max channel value
//            by default this is zero. For meaningful values, see
//            http://www.imagemagick.org/script/command-line-options.php#metric
//
assert.imageEqualsFile = function(buffer, file_b, tol, callback) {
    if (!callback) callback = function(err) { if (err) throw err; };
    file_b = path.resolve(file_b);
    var file_a = '/tmp/windshaft-test-image-' + (Math.random() * 1e16); // TODO: make predictable 
    var err = fs.writeFileSync(file_a, buffer, 'binary');
    if (err) throw err;

    var fuzz = tol + '%';
    exec('compare -fuzz ' + fuzz + ' -metric AE "' + file_a + '" "' +
            file_b + '" /dev/null', function(err, stdout, stderr) {
        if (err) {
            fs.unlinkSync(file_a);
            callback(err);
        } else {
            stderr = stderr.trim();
            var similarity = parseFloat(stderr);
            if ( similarity > 0 ) {
              var err = new Error('Images not equal(' + similarity + '): ' +
                      file_a  + '    ' + file_b);
              err.similarity = similarity;
              callback(err);
            } else {
              fs.unlinkSync(file_a);
              callback(null);
            }
        }
    });
};

/**
 * Assert response from `server` with
 * the given `req` object and `res` assertions object.
 *
 * @param {Server} server
 * @param {Object} req
 * @param {Object|Function} res
 * @param {String} msg
 */
assert.response = function(server, req, res, msg){
    var port = 5555;
    function check(){
        try {
            server.__port = server.address().port;
            server.__listening = true;
        } catch (err) {
            process.nextTick(check);
            return;
        }
        if (server.__deferred) {
            server.__deferred.forEach(function(args){
                assert.response.apply(assert, args);
            });
            server.__deferred = null;
        }
    }

    // Check that the server is ready or defer
    if (!server.fd) {
        server.__deferred = server.__deferred || [];
        server.listen(server.__port = port++, '127.0.0.1', check);
    } else if (!server.__port) {
        server.__deferred = server.__deferred || [];
        process.nextTick(check);
    }

    // The socket was created but is not yet listening, so keep deferring
    if (!server.__listening) {
        server.__deferred.push(arguments);
        return;
    }

    // Callback as third or fourth arg
    var callback = typeof res === 'function'
        ? res
        : typeof msg === 'function'
            ? msg
            : function(){};

    // Default messate to test title
    if (typeof msg === 'function') msg = null;
    msg = msg || assert.testTitle;
    msg += '. ';

    // Pending responses
    server.__pending = server.__pending || 0;
    server.__pending++;

    // Create client
    if (!server.fd) {
        server.listen(server.__port = port++, '127.0.0.1', issue);
    } else {
        issue();
    }

    function issue(){

        // Issue request
        var timer,
            method = req.method || 'GET',
            status = res.status || res.statusCode,
            data = req.data || req.body,
            requestTimeout = req.timeout || 0,
            encoding = req.encoding || 'utf8';

        var request = http.request({
            host: '127.0.0.1',
            port: server.__port,
            path: req.url,
            method: method,
            headers: req.headers
        });

        var check = function() {
            if (--server.__pending === 0) {
                server.close();
                server.__listening = false;
            }
        };

        // Timeout
        if (requestTimeout) {
            timer = setTimeout(function(){
                check();
                delete req.timeout;
                assert.fail(msg + 'Request timed out after ' + requestTimeout + 'ms.');
            }, requestTimeout);
        }

        if (data) request.write(data);

        request.on('response', function(response){
            response.body = '';
            response.setEncoding(encoding);
            response.on('data', function(chunk){ response.body += chunk; });
            response.on('end', function(){
                if (timer) clearTimeout(timer);

                // Assert response body
                if (res.body !== undefined) {
                    var eql = res.body instanceof RegExp
                      ? res.body.test(response.body)
                      : res.body === response.body;
                    assert.ok(
                        eql,
                        msg + 'Invalid response body.\n'
                            + '    Expected: ' + res.body + '\n'
                            + '    Got: ' + response.body
                    );
                }

                // Assert response status
                if (typeof status === 'number') {
                    assert.equal(
                        response.statusCode,
                        status,
                        msg + 'Invalid response status code.\n'
                            + '    Expected: [green]{' + status + '}\n'
                            + '    Got: [red]{' + response.statusCode + '}'
                    );
                }

                // Assert response headers
                if (res.headers) {
                    var keys = Object.keys(res.headers);
                    for (var i = 0, len = keys.length; i < len; ++i) {
                        var name = keys[i],
                            actual = response.headers[name.toLowerCase()],
                            expected = res.headers[name],
                            eql = expected instanceof RegExp
                              ? expected.test(actual)
                              : expected == actual;
                        assert.ok(
                            eql,
                            msg + 'Invalid response header [bold]{' + name + '}.\n'
                                + '    Expected: [green]{' + expected + '}\n'
                                + '    Got: [red]{' + actual + '}'
                        );
                    }
                }

                // Callback
                callback(response);
                check();
            });
        });

        request.end();
      }
};

// @param tolerance number of tolerated grid cell differences
assert.utfgridEqualsFile = function(buffer, file_b, tolerance, callback) {
    fs.writeFileSync('/tmp/grid.json', buffer, 'binary'); // <-- to debug/update
    var expected_json = JSON.parse(fs.readFileSync(file_b, 'utf8'));

    var err = null;

    var Celldiff = function(x, y, ev, ov) {
      this.x = x;
      this.y = y;
      this.ev = ev;
      this.ov = ov;
    };

    Celldiff.prototype.toString = function() {
      return '(' + this.x + ',' + this.y + ')["' + this.ev + '" != "' + this.ov + '"]';
    };

    try {
      var obtained_json = JSON.parse(buffer);

      // compare grid
      var obtained_grid = obtained_json.grid;
      var expected_grid = expected_json.grid;
      var nrows = obtained_grid.length
      if (nrows != expected_grid.length) {
        throw new Error( "Obtained grid rows (" + nrows +
                    ") != expected grid rows (" + expected_grid.length + ")" );
      }
      var celldiff = [];
      for (var i=0; i<nrows; ++i) {
        var ocols = obtained_grid[i];
        var ecols = expected_grid[i];
        var ncols = ocols.length;
        if ( ncols != ecols.length ) {
          throw new Error( "Obtained grid cols (" + ncols +
                   ") != expected grid cols (" + ecols.length +
                   ") on row " + i ); 
        }
        for (var j=0; j<ncols; ++j) {
          var ocell = ocols[j];
          var ecell = ecols[j];
          if ( ocell !== ecell ) {
            celldiff.push(new Celldiff(i, j, ecell, ocell));
          }
        }
      }

      if ( celldiff.length > tolerance ) {
        throw new Error( celldiff.length + " cell differences: " + celldiff );
      }

      assert.deepEqual(obtained_json.keys, expected_json.keys);
    } catch (e) { err = e; }

    callback(err);
};


