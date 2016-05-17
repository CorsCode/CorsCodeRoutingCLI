'use strict';

var logger = require('../../../utils/logger');

var routing = require('../dynamicRouter'),
	Authenticator = require('../dynamicRouter/src/authenticationFunctions');

var express = require('express');

function init(app, options) {
	options = options || {};
	options.routes = (typeof options.routes === 'undefined') ? require('../../../package.json').routes : options.routes;
	options.routers = (typeof options.routers === 'undefined') ? {
		api: true,
		admin: false,
		app: false
	} : options.routers;

	var authenticationVar = options.authenticationVar,
		authenticationModel = options.dataHooks[authenticationVar],
		authenticator = new Authenticator(authenticationModel, app.get('superSecret'));

	if(options.routers.api) {
		var apiRouter = express.Router();

		var apiRoutingSetup = new routing(options.dataHooks);

		/**
		 * This function call is expanding the routes given into an object that contains arrays
		 * - Each of these arrays holds the heirarchy of each route provided by the user
		 * - Bypass option: Pass in pre-defined routes in the above constructor
		 */
		logger.debug("Defining routes");
		apiRoutingSetup.getDefinedRoutes(options.routes);
		logger.debug("Setting up middleware");
		apiRoutingSetup.setupMiddleware(authenticator).then(function(middleware) {
			apiRouter.use(middleware);

			// Root API route (GET '/api/')
			apiRouter.get('/', function(req, res) {
				res.json({ message: 'Root for API.' });
			});

			apiRouter.post('/register', function(req, res) {
				authenticator.register(req.body.username, req.body.password, req.body.confirmPassword).then(function(data) {
					res.json(data);
				});
			});
			apiRouter.post('/login', function(req, res) {
				authenticator.login(req.body.username, req.body.password).then(function(data) {
					res.json(data);
				});
			});

			apiRouter.all('*', function(req, res) {
				apiRoutingSetup.enableRouter(req, authenticationVar, res.locals.customInfo, function(data) {
					if(typeof data.cookies !== 'undefined') {
						var i;
						for(i = 0;i < Object.keys(data.cookies).length;i++) {
							res.cookie(Object.keys(data.cookies)[i], data.cookies[Object.keys(data.cookies)[i]]);
						}
					}

					res.json(typeof data.cookies !== 'undefined' ? { data: data.data } : { data: data });
				});
			});

			// Set basename for API
			app.use('/api', apiRouter);
		});
	}

	/*if(options.routers.admin) {
		var adminRouter = express.Router();

		// Set basename for Admin
		app.use('/admin', adminRouter);
	}

	if(options.routers.app) {
		var appRouter = express.Router();

		// Set basename for App
		app.use('/', appRouter);
	}*/
	
	return app;
}

module.exports = init;
