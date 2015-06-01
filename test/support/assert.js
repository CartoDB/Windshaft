// Cribbed from the ever prolific Konstantin Kaefer
// https://github.com/mapbox/tilelive-mapnik/blob/master/test/support/assert.js

var fs = require('fs');
var http = require('http');
var path = require('path');
var exec = require('child_process').exec;

var assert = module.exports = exports = require('assert');

assert.imageEqualsFile = function(buffer, file_b, callback) {
    if (!callback) callback = function(err) { if (err) throw err; };
    file_b = path.resolve(file_b);
    var file_a = '/tmp/' + (Math.random() * 1e16);
    var err = fs.writeFileSync(file_a, buffer, 'binary');
    if (err) throw err;

    exec('compare -metric PSNR "' + file_a + '" "' +
            file_b + '" /dev/null', function(err, stdout, stderr) {
        if (err) {
            fs.unlinkSync(file_a);
            callback(err);
        } else {
            stderr = stderr.trim();
            if (stderr === 'inf') {
                fs.unlinkSync(file_a);
                callback(null);
            } else {
                var similarity = parseFloat(stderr);
                var err = new Error('Images not equal(' + similarity + '): ' +
                        file_a  + '    ' + file_b);
                err.similarity = similarity;
                callback(err);
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

