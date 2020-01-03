'use strict';

require('../../support/test_helper.js');

var assert = require('assert');
var fs = require('fs');
var Image = require('@carto/mapnik').Image;
const path = require('path');

var ImageRenderer = require('../../../lib/windshaft/renderers/plain/image_renderer');

describe('renderer_plain_image_renderer', function () {
    var patterns = [
        'congruent_pentagon',
        'eight_horns',
        'little_triangles'
    ];
    var buffers = {};

    before(function () {
        patterns.forEach(function (pattern) {
            var patternFilename = path.join(__dirname, '/../../fixtures/plain/patterns/' + pattern + '.png');
            buffers[pattern] = Buffer.from(fs.readFileSync(patternFilename, { encoding: 'binary' }), 'binary');
        });
    });

    var tiles = [
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
        [1, 1, 0],
        [1, 1, 1]
    ];

    patterns.forEach(function (pattern) {
        tiles.forEach(function (zxy) {
            it('should render image background with image ' + pattern + ' for ' + zxy.join('/'), function (done) {
                var imageRenderer = new ImageRenderer(buffers[pattern]);
                function validate (err, tile) {
                    assert.ifError(err);
                    assert.ok(tile);
                    var image = Image.fromBytes(tile);
                    var fixtureFilename = path.join(__dirname, '/../../fixtures/plain/plain_' + pattern + '_reference_' + zxy.join('-') + '.png');
                    fs.readFile(fixtureFilename, { encoding: 'binary' }, function (err, fixtureBuffer) {
                        if (err) {
                            done(err);
                        }
                        var diff = image.compare(Image.fromBytes(Buffer.from(fixtureBuffer, 'binary')));
                        assert.ok(diff < 16, 'unexpected number of different pixels: ' + diff);
                        done();
                    });
                }
                imageRenderer.getTile.apply(imageRenderer, zxy.concat(validate));
            });
        });
    });
});
