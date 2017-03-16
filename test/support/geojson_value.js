'use strict';

module.exports.singlelayer = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [
          -411852,
          4927605
        ]
      },
      "properties": {
        "updated_at": "2011-09-21T14:02:21.358706",
        "created_at": "2011-09-21T14:02:21.314252",
        "cartodb_id": 1,
        "name": "Hawai",
        "address": "Calle de Pérez Galdós 9, Madrid, Spain"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [
          -412881,
          4928181
        ]
      },
      "properties": {
        "updated_at": "2011-09-21T14:02:21.358706",
        "created_at": "2011-09-21T14:02:21.319101",
        "cartodb_id": 2,
        "name": "El Estocolmo",
        "address": "Calle de la Palma 72, Madrid, Spain"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [
          -412947,
          4927845
        ]
      },
      "properties": {
        "updated_at": "2011-09-21T14:02:21.358706",
        "created_at": "2011-09-21T14:02:21.324",
        "cartodb_id": 3,
        "name": "El Rey del Tallarín",
        "address": "Plaza Conde de Toreno 2, Madrid, Spain"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [
          -411868,
          4926450
        ]
      },
      "properties": {
        "updated_at": "2011-09-21T14:02:21.358706",
        "created_at": "2011-09-21T14:02:21.329509",
        "cartodb_id": 4,
        "name": "El Lacón",
        "address": "Manuel Fernández y González 8, Madrid, Spain"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [
          -412326,
          4928363
        ]
      },
      "properties": {
        "updated_at": "2011-09-21T14:02:21.358706",
        "created_at": "2011-09-21T14:02:21.334931",
        "cartodb_id": 5,
        "name": "El Pico",
        "address": "Calle Divino Pastor 12, Madrid, Spain"
      }
    }
  ]
};

module.exports.singlelayerPolygon = {
    "type": "FeatureCollection",
    "features": [{
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [-20037508, -15538711],
                    [-20037508, 15538711],
                    [0, 15538711],
                    [0, -15538711],
                    [-20037508, -15538711]
                ]
            ]
        },
        "properties": {
            "updated_at": "2015-11-27T15:22:56.980193",
            "created_at": "2015-11-27T15:22:56.980193",
            "cartodb_id": 1,
            "name": "west"
        }
    }]
};

module.exports.multilayer = {
    type: "FeatureCollection",
    features: [{
        type: "FeatureCollection",
        features: [{
            type: "Feature",
            geometry: {
                "type":"Point",
                "coordinates": [
                    -411852,
                    4927605
                ]
            },
            properties: {
                updated_at: "2011-09-21T14:02:21.358706",
                created_at: "2011-09-21T14:02:21.314252",
                cartodb_id: 1,
                name: "Hawai",
                address: "Calle de P\u00e9rez Gald\u00f3s 9, Madrid, Spain"
            }
        }, {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [
                    -412881,
                    4928181
                ]
            },
            properties: {
                updated_at: "2011-09-21T14:02:21.358706",
                created_at: "2011-09-21T14:02:21.319101",
                cartodb_id: 2,
                name: "El Estocolmo",
                address: "Calle de la Palma 72, Madrid, Spain"
            }
        }]
    }, {
        type: "FeatureCollection",
        features: [{
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [
                    -411852,
                    4927605
                ]
            },
            properties: {
                updated_at: "2011-09-21T14:02:21.358706",
                created_at: "2011-09-21T14:02:21.314252",
                cartodb_id: 1,
                name: "Hawai",
                address: "Calle de P\u00e9rez Gald\u00f3s 9, Madrid, Spain"
            }
        }, {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [
                    -412881,
                    4928181
                ]
            },
            properties: {
                updated_at: "2011-09-21T14:02:21.358706",
                created_at: "2011-09-21T14:02:21.319101",
                cartodb_id: 2,
                name: "El Estocolmo",
                address: "Calle de la Palma 72, Madrid, Spain"
            }
        }, {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [
                    -412947,
                    4927845
                ]
            },
            properties: {
                updated_at: "2011-09-21T14:02:21.358706",
                created_at: "2011-09-21T14:02:21.324",
                cartodb_id: 3,
                name: "El Rey del Tallar\u00edn",
                address: "Plaza Conde de Toreno 2, Madrid, Spain"
            }
        }, {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [
                    -411868,
                    4926450
                ]
            },
            properties: {
                updated_at: "2011-09-21T14:02:21.358706",
                created_at: "2011-09-21T14:02:21.329509",
                cartodb_id: 4,
                name: "El Lac\u00f3n",
                address: "Manuel Fern\u00e1ndez y Gonz\u00e1lez 8, Madrid, Spain"
            }
        }]
    }, {
        type: "FeatureCollection",
        features: [{
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [
                    -411852,
                    4927605
                ]
            },
            properties: {
                updated_at: "2011-09-21T14:02:21.358706",
                created_at: "2011-09-21T14:02:21.314252",
                cartodb_id: 1,
                name: "Hawai",
                address: "Calle de P\u00e9rez Gald\u00f3s 9, Madrid, Spain"
            }
        }, {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [
                    -412881,
                    4928181
                ]
            },
            properties: {
                updated_at: "2011-09-21T14:02:21.358706",
                created_at: "2011-09-21T14:02:21.319101",
                cartodb_id: 2,
                name: "El Estocolmo",
                address: "Calle de la Palma 72, Madrid, Spain"
            }
        }, {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [
                    -412947,
                    4927845
                ]
            },
            properties: {
                updated_at: "2011-09-21T14:02:21.358706",
                created_at: "2011-09-21T14:02:21.324",
                cartodb_id: 3,
                name: "El Rey del Tallar\u00edn",
                address: "Plaza Conde de Toreno 2, Madrid, Spain"
            }
        }]
    }]
};

module.exports.makeValidGeojson = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [
            0,
            0
          ],
          [
            100000,
            200000
          ]
        ]
      },
      "properties": {
          "cartodb_id": 1
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "MultiLineString",
        "coordinates": [
          [
            [
              0,
              0
            ],
            [
              100000,
              100000
            ]
          ],
          [
            [
              100000,
              100000
            ],
            [
              100000,
              200000
            ]
          ]
        ]
      },
      "properties": {
          "cartodb_id": 2
      }
    }
  ]
};
