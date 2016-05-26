'use strict';

var express = require('express'),
	parentApp = express();

var core = require('./core');

/**
 * Default options:
 * - config: {
 *		port: (process.env.NODE_ENV === 'development' ? 8080 : 80)
 *		secret: 'THISNEEDSTOBECHANGEDFORPRODUCTIONUSE'
 *		authenticationVar: 'users'
 * }
 */
core({
	rootApp: parentApp
}).then(function(server) {
	server.start(parentApp);
});
