'use strict';

var express = require('express'),
	parentApp = express();

var Updater = require('./utils/updater'),
	core = require('./core');

/**
 * Default options:
 * - config: {
 *		port: (process.env.NODE_ENV === 'development' ? 8080 : 80)
 *		secret: 'THISNEEDSTOBECHANGEDFORPRODUCTIONUSE'
 *		authenticationVar: 'users'
 * }
 */
Updater.checkModels().then(function(done) {
	if(done) {
		core({
			rootApp: parentApp
		}).then(function(server) {
			server.start(parentApp);
		});
	}
});
