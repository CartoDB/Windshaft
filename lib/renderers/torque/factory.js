'use strict';

const carto = require('carto');
const debug = require('debug')('windshaft:renderer:torque_factory');
const PSQL = require('cartodb-psql');
const torqueReference = require('torque.js').cartocss_reference;
const RendererParams = require('../renderer-params');
const sql = require('../../utils/sql');
const Renderer = require('./renderer');
const PSQLAdaptor = require('./psql-adaptor');
const PngRenderer = require('./png-renderer');
const BaseAdaptor = require('../base-adaptor');
const SubstitutionTokens = require('cartodb-query-tables').utils.substitutionTokens;

const formatToRenderer = {
    'torque.json': Renderer,
    'torque.bin': Renderer,
    'json.torque': Renderer,
    'bin.torque': Renderer,
    png: PngRenderer,
    'torque.png': PngRenderer
};

// API: initializes the renderer, it should be called once
//
// @param options initialization options.
//     - sqlClass: class used to access postgres, by default is PSQL
//         the class should provide the following interface
//          - constructor(params) where params should contain:
//            host, port, database, user, password.
//            the class is always constructed with dbParams passed to
//            getRender as-is
//          - query(sql, callback(err, data), readonly)
//            gets an SQL query and return a javascript object with
//            the same structure of a JSON format response from
//            CartoDB-SQL-API, for reference see
//            http://github.com/CartoDB/CartoDB-SQL-API/blob/1.8.2/doc/API.md#json
//            The 'readonly' parameter (false by default) requests
//            that running the query should not allowed to change the database.
//     - dbPoolParams: database connection pool params
//          - size: maximum number of resources to create at any given time
//          - idleTimeout: max milliseconds a resource can go unused before it should be destroyed
//          - reapInterval: frequency to check for idle resources
module.exports = class TorqueFactory {
    static get NAME () {
        return 'torque';
    }

    constructor (options = {}) {
        this.options = Object.assign({
            sqlClass: PSQLAdaptor(PSQL, options.dbPoolParams)
        }, options);
    }

    getName () {
        return TorqueFactory.NAME;
    }

    supportsFormat (format) {
        return !!formatToRenderer[format];
    }

    getAdaptor (renderer, onTileErrorStrategy) {
        return new BaseAdaptor(renderer, onTileErrorStrategy);
    }

    getRenderer (mapConfig, format, options, callback) {
        const layer = options.layer;

        if (layer === undefined) {
            return callback(new Error('torque renderer only supports a single layer'));
        }

        if (!formatToRenderer[format]) {
            return callback(new Error('format not supported: ' + format));
        }

        const layerObj = mapConfig.getLayer(layer);

        if (!layerObj) {
            return callback(new Error('layer index is greater than number of layers'));
        }

        if (layerObj.type !== 'torque') {
            return callback(new Error('layer ' + layer + ' is not a torque layer'));
        }

        const dbParams = Object.assign({}, RendererParams.dbParamsFromReqParams(options.params), mapConfig.getLayerDatasource(layer));
        const pgSQL = sql(dbParams, this.options.sqlClass);

        fetchMapConfigAttributes(pgSQL, layerObj, (err, params) => {
            if (err) {
                return callback(err);
            }

            var RendererClass = formatToRenderer[format];

            callback(null, new RendererClass(layerObj, pgSQL, params, layer));
        });
    }
};

//
// given cartocss return javascript properties
//
// @param required optional array of required properties
//
// @throw Error if required properties are not found
//
function attrsFromCartoCSS (cartocss, required) {
    const attrsKeys = {
        '-torque-frame-count': 'steps',
        '-torque-resolution': 'resolution',
        '-torque-animation-duration': 'animationDuration',
        '-torque-aggregation-function': 'countby',
        '-torque-time-attribute': 'column',
        '-torque-data-aggregation': 'data_aggregation'
    };

    carto.tree.Reference.setData(torqueReference.version.latest);

    const env = {
        benchmark: false,
        validation_data: false,
        effects: [],
        errors: [],
        error: function (e) {
            this.errors.push(e);
        }
    };
    const symbolizers = torqueReference.version.latest.layer;
    const root = (carto.Parser(env)).parse(cartocss);
    const definitions = root.toList(env);
    const rules = getMapProperties(definitions, env);
    const attrs = {};

    for (const k in attrsKeys) {
        if (rules[k]) {
            attrs[attrsKeys[k]] = rules[k].value.toString();
            const element = rules[k].value.value[0];
            const type = symbolizers[k].type;
            if (!checkValidType(element, type)) {
                throw new Error("Unexpected type for property '" + k + "', expected " + type);
            }
        } else if (required && required.indexOf(attrsKeys[k]) !== -1) {
            throw new Error("Missing required property '" + k + "' in torque layer CartoCSS");
        }
    }

    return attrs;
}

function checkValidType (e, type) {
    if (['number', 'float'].indexOf(type) > -1) {
        return typeof e.value === 'number';
    } else if (type === 'string') {
        return e.value !== 'undefined' && typeof e.value === 'string';
    } else if (type.constructor === Array) {
        return type.indexOf(e.value) > -1 || e.value === 'linear';
    } else if (type === 'color') {
        return checkValidColor(e);
    }
    return true;
}

function checkValidColor (e) {
    var expectedArguments = { rgb: 3, hsl: 3, rgba: 4, hsla: 4 };
    return typeof e.rgb !== 'undefined' || expectedArguments[e.name] === e.args;
}

//
// get rules from Map definition
// stores errors in env.error
//
function getMapProperties (definitions, env) {
    var rules = {};
    definitions.filter(function (r) {
        return r.elements.join('') === 'Map';
    }).forEach(function (r) {
        for (var i = 0; i < r.rules.length; i++) {
            var key = r.rules[i].name;
            rules[key] = r.rules[i].ev(env);
        }
    });
    return rules;
}

//
// check layer and raise an exception is some error is found
//
// @throw Error if missing or malformed CartoCSS
//
function _checkLayerAttributes (layerConfig) {
    var cartoCSS = layerConfig.options.cartocss;
    if (!cartoCSS) {
        throw new Error("cartocss can't be undefined");
    }
    var checks = ['steps', 'resolution', 'column', 'countby'];
    return attrsFromCartoCSS(cartoCSS, checks);
}

// returns an array of errors if the mapconfig is not supported or contains errors
// errors is empty is the configuration is ok
// dbParams: host, dbname, user and pass
// layer: optional, if is specified only a layer is checked
function fetchMapConfigAttributes (sql, layer, callback) {
    // check attrs
    var attrs;
    try {
        attrs = _checkLayerAttributes(layer);
    } catch (e) {
        return callback(e);
    }

    // fetch layer attributes to check the query and so on is ok
    var layerSql = layer.options.sql;
    fetchLayerAttributes(sql, layerSql, attrs, function (err, layerAttrs) {
        if (err) {
            return callback(err);
        }
        callback(null, Object.assign(attrs, layerAttrs));
    });
}

function fetchLayerAttributes (sql, layerSql, attrs, callback) {
    layerSql = SubstitutionTokens.replaceXYZ(layerSql, { x: 0, y: 0, z: 0 });

    // first step, fetch the schema to know if torque colum is time column
    const columnsQuery = `select * from (${layerSql}) __torque_wrap_sql limit 0`;
    sql(columnsQuery, function (err, data) {
        // second step, get time bounds to calculate step
        if (err) {
            err.message = 'TorqueRenderer: ' + err.message;
            return callback(err);
        }

        if (!data) {
            debug(`ERROR: layer query '${layerSql}' returned no data`);
            const noDataError = new Error('TorqueRenderer: Layer query returned no data');
            return callback(noDataError);
        }

        if (!Object.prototype.hasOwnProperty.call(data.fields, attrs.column)) {
            debug(`ERROR: layer query ${layerSql} does not include time-attribute column '${attrs.column}'`);
            const columnError = new Error(
                `TorqueRenderer: Layer query did not return the requested time-attribute column '${attrs.column}'`
            );
            return callback(columnError);
        }

        const isTime = data.fields[attrs.column].type === 'date';
        const stepQuery = getAttributesStepQuery(layerSql, attrs.column, isTime);
        sql(stepQuery, function generateMetadata (err, data) {
            // prepare metadata needed to render the tiles
            if (err) {
                err.message = 'TorqueRenderer: ' + err.message;
                return callback(err);
            }

            data = data.rows[0];

            let attributeStep = (data.max_date - data.min_date + 1) / Math.min(attrs.steps, data.num_steps >> 0);
            attributeStep = Math.abs(attributeStep) === Infinity ? 0 : attributeStep;

            const attributes = {
                start: data.min_date,
                end: data.max_date,
                step: attributeStep || 1,
                data_steps: data.num_steps >> 0,
                is_time: isTime
            };

            callback(null, attributes);
        });
    });
}

function getAttributesStepQuery (layerSql, column, isTime) {
    let maxCol = `max(${column})`;
    let minCol = `min(${column})`;
    if (isTime) {
        maxCol = `date_part('epoch', ${maxCol})`;
        minCol = `date_part('epoch', ${minCol})`;
    }

    return `
        SELECT count(*) as num_steps, ${maxCol} max_date, ${minCol} min_date
        FROM  (${layerSql}) __torque_wrap_sql
    `;
}
