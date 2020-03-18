'use strict';

const { promisify } = require('util');
const request = promisify(require('request'));
const Timer = require('../../stats/timer');

module.exports = async function fetchImage (requestOpts) {
    const timer = new Timer();
    timer.start('render');

    try {
        const { response, buffer } = await fetch(requestOpts);
        timer.end('render');

        return { buffer, headers: response.headers, stats: timer.getTimes() };
    } catch (err) {
        const errorMessage = `Unable to fetch http tile: ${requestOpts.url}${err.statusCode ? ` [${err.statusCode}]` : ''}`;
        const httpError = new Error(errorMessage);

        if (err.code) {
            httpError.code = err.code;
        }

        throw httpError;
    }
};

function fetch (options) {
    return new Promise((resolve, reject) => {
        request(options, function (err, response, buffer) {
            if (err) {
                return reject(err);
            }

            if (response.statusCode !== 200) {
                const err = new Error();
                err.statusCode = response.statusCode;
                return reject(err);
            }

            return resolve({ response, buffer });
        });
    });
}
