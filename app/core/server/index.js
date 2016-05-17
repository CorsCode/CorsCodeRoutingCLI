'use strict';

var routes = require('./routes'),
	server = require('./build');

var mongoose = require('mongoose'),
	Promise = require('bluebird');

function load(options) {
	try {
		/**
		 * Load routes
		 * - Default options: {
		 *		routes: require('../../../package.json').routes
		 *		routers: {
		 *			api: true,
		 *			admin: false,
		 *			app: false
		 *		}
		 * }
		 * - Required options: {
		 *		dataHooks
		 * }
		 */
		// NOTE: currently, this only supports API
		routes(options.rootApp, {
			dataHooks: require('../models/hooks')(mongoose),
			authenticationVar: options.config.authenticationVar
		});
	} catch(e) {
		// Do nothing
	} finally {
		// Build server for options.rootApp
		return new server(options);
	}
}

module.exports = load;
