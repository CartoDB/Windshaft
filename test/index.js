'use strict';

const util = require('util');
const exec = util.promisify(require('child_process').exec);
const semver = require('semver');

if (!process.env.NODE_ENV) {
    console.error('Please set "NODE_ENV" variable, e.g.: "NODE_ENV=test"');
    process.exit(1);
}

const environment = require(`../config/environments/${process.env.NODE_ENV}.js`);
const REDIS_PORT = environment.redis.port;

const TEST_DB = 'windshaft_test';
const TEST_DB_2 = 'windshaft_test2';
const PGUSER = 'postgres';

async function startRedis () {
    await exec(`redis-server --port ${REDIS_PORT} --logfile ${__dirname}/redis-server.log --daemonize yes`);
}

async function stopRedis () {
    await exec(`redis-cli -p ${REDIS_PORT} shutdown`);
}

async function dropDatabase ({ name = TEST_DB } = {}) {
    await exec(`dropdb --if-exists ${name}`, {
        env: Object.assign({ PGUSER }, process.env)
    });
}

async function createDatabase ({ name = TEST_DB, template = 'template_postgis' } = {}) {
    await exec(`createdb -T ${template} -EUTF8 "${name}"`, {
        env: Object.assign({ PGUSER }, process.env)
    });
}

async function populateDatabase ({ name = TEST_DB } = {}) {
    const filenames = [
        'windshaft.test',
        'populated_places_simple_reduced'
    ].map(filename => `${__dirname}/fixtures/${filename}.sql`);

    const populateDatabaseCmd = `
        cat ${filenames.join(' ')} |
        PGOPTIONS='--client-min-messages=WARNING' psql -q -v ON_ERROR_STOP=1 ${name}
    `;

    await exec(populateDatabaseCmd, {
        env: Object.assign({ PGUSER }, process.env)
    });
}

async function createPostGISRaster ({ name = TEST_DB } = {}) {
    const getPostGISVersionCmd = 'psql -c "SELECT default_version FROM pg_available_extensions WHERE name = \'postgis\';" -t';

    const { stdout } = await exec(getPostGISVersionCmd, {
        env: Object.assign({ PGUSER }, process.env)
    });
    const postgisVersion = stdout.trim();

    if (semver.lt(postgisVersion, '3.0.0')) {
        return;
    }

    const installPostGISRasterCmd = `psql -c 'CREATE EXTENSION postgis_raster' ${name}`;

    await exec(installPostGISRasterCmd, {
        env: Object.assign({ PGUSER }, process.env)
    });
}

async function main (args) {
    let code = 0;

    try {
        switch (args[0]) {
        case 'setup':
            await startRedis();
            await dropDatabase({ name: TEST_DB });
            await createDatabase({ name: TEST_DB });
            await createPostGISRaster({ name: TEST_DB });
            await populateDatabase({ name: TEST_DB });
            await dropDatabase({ name: TEST_DB_2 });
            await createDatabase({ name: TEST_DB_2, template: TEST_DB });
            break;
        case 'teardown':
            await stopRedis();
            break;
        default:
            throw new Error('Missing "mode" argument. Valid ones: "setup" or "teardown"');
        }
    } catch (err) {
        console.error(err);
        code = 1;
    } finally {
        process.exit(code);
    }
}

main(process.argv.slice(2));
