// Cribbed from the ever prolific Konstantin Kaefer
// https://github.com/mapbox/tilelive-mapnik/blob/master/test/support/assert.js

var fs = require('fs');
var path = require('path');
var util = require('util');

var mapnik = require('mapnik');
var debug = require('debug')('windshaft:assert');

var assert = module.exports = exports = require('assert');

/**
 * Check to GeoJSON are deeply equal.
 *
 * Properties check dates using new Date().getTime().
 * All properties with key matching `/_at$/` regex will be validated as dates.
 *
 * @param actual The GeoJSON to validate
 * @param expected GeoJSON reference
 */
assert.deepEqualGeoJSON = function(actual, expected) {
    assert.equal(actual.type, expected.type);
    assert.equal(actual.features.length, expected.features.length);

    var featureCollections = actual.features.filter(featureCollectionFilter);
    var expectedFeatureCollections = actual.features.filter(featureCollectionFilter);
    featureCollections.forEach(function(featureCollection, idx) {
        return assert.deepEqualGeoJSON(featureCollection, expectedFeatureCollections[idx]);
    });

    var featuresByCartodbId = expected.features.reduce(cartodbIdFeatureReducer, {});
    var expectedFeaturesByCartodbId = expected.features.reduce(cartodbIdFeatureReducer, {});

    Object.keys(featuresByCartodbId).forEach(function(cartodbId) {
        var feature = featuresByCartodbId[cartodbId];
        var expectedFeature = expectedFeaturesByCartodbId[cartodbId];
        assert.ok(expectedFeature, 'missing expected feature for cartodb_id=' + cartodbId);

        assert.deepEqual(feature.geometry, expectedFeature.geometry);

        Object.keys(feature.properties).forEach(function(pKey) {
            if (pKey.match(/_at$/)) {
                var actualDate = new Date(feature.properties[pKey]);
                var expectedDate = new Date(expectedFeature.properties[pKey]);
                assert.equal(actualDate.getTime(), expectedDate.getTime());
            } else {
                assert.equal(feature.properties[pKey], expectedFeature.properties[pKey]);
            }
        });
    });
};

function cartodbIdFeatureReducer(byIdAcc, feature) {
    byIdAcc[feature.properties.cartodb_id] = feature;
    return byIdAcc;
}

function featureCollectionFilter(feature) {
    return feature.type === 'FeatureCollection';
}

/**
 * Takes an image data as an input and an image path and compare them using Mapnik's Image.compare in case the
 * similarity is not within the tolerance limit it will callback with an error.
 *
 * @param buffer The image data to compare from
 * @param {string} referenceImageRelativeFilePath The relative file to compare against
 * @param {number} tolerance tolerated mean color distance, as a per mil (‰)
 * @param {function} callback Will call to home with null in case there is no error, otherwise with the error itself
 * @see FUZZY in http://www.imagemagick.org/script/command-line-options.php#metric
 */
assert.imageEqualsFile = function(buffer, referenceImageRelativeFilePath, tolerance, callback) {
    callback = callback || function(err) { assert.ifError(err); };

    var referenceImageFilePath = path.resolve(referenceImageRelativeFilePath);

    var testImage = mapnik.Image.fromBytes(buffer);
    var referenceImage = mapnik.Image.fromBytes(fs.readFileSync(referenceImageFilePath,  { encoding: null }));

    imagesAreSimilar(testImage, referenceImage, tolerance, function(err) {
        if (err) {
            var testImageFilePath = randomImagePath();
            testImage.save(testImageFilePath);
            debug("Images didn't match, test image is %s, expected is %s", testImageFilePath, referenceImageFilePath);
        }
        callback(err);
    });
};

assert.imageBuffersAreEqual = function(bufferA, bufferB, tolerance, persist, callback) {

    var imageA = mapnik.Image.fromBytes(bufferA);
    var imageB = mapnik.Image.fromBytes(bufferB);

    imagesAreSimilar(imageA, imageB, tolerance, function(err, similarity) {
        var imageFilePaths = [];
        if (persist) {
            var randStr = (Math.random() * 1e16).toString().substring(0, 8);
            var imageFilePathA = randomImagePath(randStr + '-a');
            var imageFilePathB = randomImagePath(randStr + '-b');
            imageA.save(imageFilePathA);
            imageB.save(imageFilePathB);

            imageFilePaths = [imageFilePathA, imageFilePathB];
        }
        callback(err, imageFilePaths, similarity);
    });
};

function randomImagePath(nameHint) {
    nameHint = nameHint || 'test';
    return path.resolve('test/results/png/image-' + nameHint + '-' + Date.now() + '.png');
}

function imagesAreSimilar(testImage, referenceImage, tolerance, callback) {
    if (testImage.width() !== referenceImage.width() || testImage.height() !== referenceImage.height()) {
        debug('Images are not the same size (width x height');
        return callback(new Error('Images are not the same size'));
    }

    var pixelsDifference = referenceImage.compare(testImage);
    var similarity = pixelsDifference / (referenceImage.width() * referenceImage.height());
    var tolerancePerMil = (tolerance / 1000);

    if (similarity > tolerancePerMil) {
        var err = new Error(
            util.format('Images are not similar (got %d similarity, expected %d)', similarity, tolerancePerMil)
        );
        err.similarity = similarity;
        callback(err, similarity);
    } else {
        callback(null, similarity);
    }
}

function Celldiff(x, y, ev, ov) {
    this.x = x;
    this.y = y;
    this.ev = ev;
    this.ov = ov;
}

Celldiff.prototype.toString = function() {
    return '(' + this.x + ',' + this.y + ')["' + this.ev + '" != "' + this.ov + '"]';
};

// @param tolerance number of tolerated grid cell differences
// jshint maxcomplexity:9
assert.utfgridEqualsFile = function(buffer, referenceFile, tolerance, callback) {
    //fs.writeFileSync('/tmp/grid.json', buffer, 'binary'); // <-- to debug/update
    var expected_json = JSON.parse(fs.readFileSync(referenceFile, 'utf8'));

      var obtained_json = Object.prototype.toString() === buffer.toString() ? buffer : JSON.parse(buffer);

      // compare grid
      var obtained_grid = obtained_json.grid;
      var expected_grid = expected_json.grid;
      var nrows = obtained_grid.length;
      if (nrows !== expected_grid.length) {
          return callback(
              new Error("Obtained grid rows (" + nrows + ") != expected grid rows (" + expected_grid.length + ")" )
          );
      }
      var celldiff = [];
      for (var i=0; i<nrows; ++i) {
        var ocols = obtained_grid[i];
        var ecols = expected_grid[i];
        var ncols = ocols.length;
        if ( ncols !== ecols.length ) {
            return callback(
                new Error("Obtained grid cols (" + ncols + ") != expected grid cols (" + ecols.length + ") on row " + i)
            );
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
          return callback(new Error( celldiff.length + " cell differences: " + celldiff ));
      }

    try {
      assert.deepEqual(obtained_json.keys, expected_json.keys);
    } catch (e) {
        return callback(e);
    }

    return callback();
};
