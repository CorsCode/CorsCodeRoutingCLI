'use strict';

var logger = require('./logger');

var bodyParser = require('body-parser'),
	cookieParser = require('cookie-parser'),
	compression = require('compression'),
	helmet = require('helmet'),
	morgan = require('morgan'),
	fs = require('fs'),
	path = require('path');

function config(app, options) {
	logger.debug("Setting port to 8080");
	app.set('port', process.env.PORT || options.port); // Sets port
	app.set('superSecret', options.secret);
	logger.debug("Enabling body parser w/ parse urlencoded request bodies");
	app.use(bodyParser.urlencoded({ extended: false }));
	app.use(bodyParser.json());
	logger.debug("Enabling cookie parser");
	app.use(cookieParser());
	logger.debug("Enabling GZip Compression");
	app.use(compression());
	logger.debug("Enabling Helmet");
	app.use(helmet());

	var logDirectory = path.resolve(path.join(__dirname, '/logs'));
	// Ensure log directory exists
	fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);

	logger.debug("Overriding 'Express' logger");
	app.use(morgan('combined', {
		'stream': logger.stream
	}));

	return app;
}

module.exports = config;
