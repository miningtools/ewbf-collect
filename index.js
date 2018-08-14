#!/usr/bin/env node

'use strict';

const Config = require('./config/config');
const http = require('http');
const winston = require('winston');
const moment = require('moment-timezone');
const Influx = require('influx');


const winstonTransports = function () {
    var transports = [];
    if (Config.log_mode === 'console')
        transports = [
            new (winston.transports.Console)({
                level: Config.log_level,
            })];
    if (Config.log_mode === 'file')
        transports = [
            new (winston.transports.File)({
                level: Config.log_level,
                filename: Config.log_file,
            })];
    if (Config.log_mode === 'both')
        transports = [
            new (winston.transports.Console)({
                level: Config.log_level,
            }),
            new (winston.transports.File)({
                level: Config.log_level,
                filename: Config.log_file,
            })];
    return transports;
}

const winstonTimestamp = winston.format((info, opts) => {
    if (opts.tz)
        info.timestamp = moment().tz(opts.tz).format('YYYY-MM-DD HH:mm:ss');
    return info;
});

const logger = winston.createLogger({
    level: Config.log_level,
    format: winston.format.combine(winstonTimestamp({ tz: moment.tz.guess() }), winston.format.simple(), winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}` + (info.splat !== undefined ? `${info.splat}` : " "))),
    transports: winstonTransports()
});

process.on("uncaughtException", function (err) { logger.error(err.stack); });

process.on("SIGUSR1", function () { logger.info("Reloading...\r\n"); });

process.once("SIGTERM", function () { logger.info("Stopping...\r\n"); });

const influx = new Influx.InfluxDB({
    host: Config.influxdb.db.host,
    port: Config.influxdb.db.port,
    database: Config.influxdb.db.name,
    schema: Config.influxdb.schema
});


const influxWrite = function (schema, host, instance, type, type_instance, value, text) {
    var tags;
    if (type_instance === '') { tags = { host: host, instance: instance, type: type } } else {
        tags = { host: host, instance: instance, type: type, type_instance: type_instance }
    }
    influx.writePoints([
        {
            measurement: schema,
            tags: tags,
            fields: { text: text, value: value },
        }
    ], {
            database: Config.influxdb.db.name
        })
        .catch(error => {
            logger.error(`Error saving data to InfluxDB!` + " measurement: " + schema + " host: " + host + " instance: " + instance + " type: " + type + " type_instance:" + type_instance + " value: " + value + " text: '" + text + "'")
        });
}

const hostInstanceExists = function (host, instance) {
    influx.query(`select * FROM "summary" where "host"='${host}' and "instance" = '${instance}' limit 1`).then(results => {
        if (results.length === 1) {
            influxWrite("summary", host, instance, 'UPTIME', '', 0, '');

        }
    })
}

var influxDbExists = function () {
    influx.getDatabaseNames()
        .then(names => {
            if (!names.includes(Config.influxdb.db.name)) {
                logger.warn('db ' + Config.influxdb.db.name + ' not found. create it.')
                return influx.createDatabase(Config.influxdb.db.name);
            }
        })
        .then(() => {
            refreshAllData()
        })
        .catch(error => console.log({ error }));
}

var envStr = '';
if (Config.env !== 'prod') {
    envStr = ' in ' + Config.env + ' mode';
}

logger.info('Starting ewbf-collect...\r\n');

var writeData = function (host, data) {

    var i = 0;
    var POWERSUM = 0;
    var HASHRATESUM = 0;
    var ACCEPTEDSHARES = 0;
    var REJECTEDSHARES = 0;

    let start_time = data.start_time;
    let POOL = data.current_server;
    let current_time = Math.round(+new Date().getTime() / 1000)
    let UPTIME = current_time - start_time;
    let GPUS = data.result.length


    data.result.forEach(row => {
        logger.debug(row.gpuid + ',' + row.name + ',' + row.gpu_power_usage + ',' + row.speed_sps + ',' + row.accepted_shares + ',' + row.rejected_shares + ',' + row.temperature)

        POWERSUM += row.gpu_power_usage;
        HASHRATESUM += row.speed_sps;
        ACCEPTEDSHARES += row.accepted_shares;
        REJECTEDSHARES += row.rejected_shares;

        //------schema ----------- host ---- instance -- type---- type_instance - value - text ---------------------------------------------------------- 
        influxWrite('threads', host.name, host.port, 'GPU_NAME', row.gpuid, null, row.name);

        influxWrite('threads', host.name, host.port, 'POWER', row.gpuid, row.gpu_power_usage, '');
        influxWrite('threads', host.name, host.port, 'HASHRATE', row.gpuid, row.speed_sps, '');
        influxWrite('threads', host.name, host.port, 'TEMP', row.gpuid, row.temperature, '');

        influxWrite('threads', host.name, host.port, 'ACCEPTED_SHARES', row.gpuid, row.accepted_shares, '');
        influxWrite('threads', host.name, host.port, 'REJECTED_SHARES', row.gpuid, row.rejected_shares, '');

    });

    influxWrite('summary', host.name, host.port, 'UPTIME', '', UPTIME, '');
    influxWrite('summary', host.name, host.port, 'POOL', '', null, POOL);
    influxWrite('summary', host.name, host.port, 'ACCEPTED_SHARES', '', ACCEPTEDSHARES, '');
    influxWrite('summary', host.name, host.port, 'REJECTED_SHARES', '', REJECTEDSHARES, '');
    influxWrite('summary', host.name, host.port, 'POWER_SUM', '', POWERSUM, '');
    influxWrite('summary', host.name, host.port, 'HASHRATE_SUM', '', HASHRATESUM, '');
    influxWrite('summary', host.name, host.port, 'GPUS', '', GPUS, '');

}

var run = function (host) {

    try {
        http.get('http://' + host.address + ':' + host.port + '/getstat', (resp) => {
            let data = '';

            // A chunk of data has been recieved.
            resp.on('data', (chunk) => {
                data += chunk;
            });

            // The whole response has been received. Print out the result.
            resp.on('end', () => {


                data = JSON.parse(data);
                writeData(host, data);
             
            });

        }).on("error", (err) => {
            logger.error(err.message);
        });
    } catch (err) {
        logger.error('Connection refused: ', err);
    }

}

var refreshAllData = function () {
    Config.hosts.forEach(host => {
        logger.debug(host.name);
        run(host);
    });
}

logger.info('Started ewbf-collect' + envStr + '.\r\n');

influxDbExists();

var refresh = setInterval(function () {
    refreshAllData();
}, Config.interval * 1000);

