/**
 * Dependencies
 */
var FileStreamRotator = require('file-stream-rotator'),
	fs = require('fs'),
	morgan = require('morgan');

var bodyParser = require('body-parser'),
	cookieParser = require('cookie-parser'),
	helmet = require('helmet');

module.exports = function(app, path) {
	/**
	 * Configuration
	 */
	app.set('port', process.env.PORT || 8080); // Sets port

	app.use(bodyParser.urlencoded({ extended: false }));
	app.use(bodyParser.json());
	app.use(cookieParser());
	app.use(helmet());

	/**
	 * Logging
	 */
	if(!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
		// Log all requests to console
		app.use(morgan('dev'));
	} else {
		var logDirectory = __dirname + '/logs';
		// Ensure log directory exists
		fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);
		// Create a rotating write stream
		var accessLogStream = FileStreamRotator.getStream({
			date_format: 'YYYYMMDD',
			filename: logDirectory + '/access-%DATE%.log',
			frequency: 'daily',
			verbose: false
		});

		// Log all requests to file
		app.use(morgan('combined', { stream: accessLogStream }));
	}

	return app;
};
