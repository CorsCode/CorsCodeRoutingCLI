'use strict';

var configuration = require('../utils/configuration'),
	logger = require('../utils/logger');
var server = require('./server');

var mongoose = require('mongoose'),
	Promise = require('bluebird');

// Set the default environment to be `development`
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

function makeServer(options) {
	options.config = options.config || {};
	options.config.port = (typeof options.config.port === 'undefined') ? (process.env.NODE_ENV === 'development' ? 8080 : 80) : options.config.port;
	options.config.secret = (typeof options.config.secret === 'undefined') ? 'THISNEEDSTOBECHANGEDFORPRODUCTIONUSE' : options.config.secret;
	options.config.authenticationVar = (typeof options.config.authenticationVar === 'undefined') ? require('../package.json').authenticationVar : options.config.authenticationVar;

	return new Promise(function(resolve) {
		try {
			mongoose.connect(require('../package.json').mongoose_connection);
			configuration(options.rootApp, options.config);
		} catch(e) {
			// Do nothing
		} finally {
			logger.info("Express configured");
			resolve(server(options));
		}
	});
}

module.exports = makeServer;
