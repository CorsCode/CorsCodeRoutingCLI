'use strict';

var requestIp = require('request-ip');

var routeFunctions = require('./src/routeFunctions'),
	crudFunctions = require('./src/crudFunctions');

module.exports = {
	init: function(reqMethod, definedRoutes, dataHooks) {
		var curKey, baseFunctions = {}, dataVars = {};

		var i, x;
		for(i = 0;i < Object.keys(definedRoutes).length;i++) {
			curKey = Object.keys(definedRoutes)[i];
			baseFunctions[curKey] = [];

			var curRoute;
			for(x = 0;x < definedRoutes[curKey].length;x += 2) {
				curRoute = definedRoutes[curKey][x];

				curRoute = routeFunctions.deferRequest(curRoute);
			}

			var y;
			for(y = 0;y < curRoute.length;y += 2) {
				baseFunctions[curKey].push(reqMethod.toLowerCase() + (curRoute[y].charAt(0).toUpperCase() + curRoute[y].slice(1)));
			}
		}

		for(i = 0;i < Object.keys(definedRoutes).length;i++) {
			curKey = Object.keys(definedRoutes)[i];
			dataVars[curKey] = [];

			for(x = 0;x < baseFunctions[curKey].length;x++) {
				var dataVar = baseFunctions[curKey][x].slice(reqMethod.length).toLowerCase();
				dataVars[curKey].push(dataVar);
			}
		}

		for(i = 0;i < Object.keys(definedRoutes).length;i++) {
			curKey = Object.keys(definedRoutes)[i];

			for(x = 0;x < baseFunctions[curKey].length;x++) {
				if(reqMethod === 'GET') {
					this.actualFunctions[baseFunctions[curKey][x]] = crudFunctions.getFunction(x, dataVars[curKey], dataHooks);
				} else if(reqMethod === 'POST') {
					this.actualFunctions[baseFunctions[curKey][x]] = crudFunctions.postFunction(x, dataVars[curKey], dataHooks);
				} else if(reqMethod === 'PUT') {
					this.actualFunctions[baseFunctions[curKey][x]] = crudFunctions.putFunction(x, dataVars[curKey], dataHooks);
				} else if(reqMethod === 'DELETE') {
					this.actualFunctions[baseFunctions[curKey][x]] = crudFunctions.deleteFunction(x, dataVars[curKey], dataHooks);
				}
			}
		}
	},
	getDefinedRoutes: function(routes) {
		return routeFunctions.expandRoutes(routes);
	},
	setupMiddleware: function(router, definedRoutes, dataHooks) {
		this.init('GET', definedRoutes, dataHooks);
		this.init('POST', definedRoutes, dataHooks);
		this.init('PUT', definedRoutes, dataHooks);
		this.init('DELETE', definedRoutes, dataHooks);

		// Actual middleware
		return router.use(function(req, res, next) {
			console.log('Something is happening on the API!');

			res.locals.customInfo = routeFunctions.confirmRoutes(req.url, req.method, definedRoutes);
			if(res.locals.customInfo !== 'no route found') res.locals.customInfo.push(requestIp.getClientIp(req));

			next();
		});
	},
	enableRouter: function(req, customInfo, authentication, cb) {
		if(!authentication) console.log('no authentication');
		else authentication = authentication.replace(/^\/|\/$/g, '');

		if(customInfo !== 'no route found') {
			var reqMethod = customInfo[0];
			var sepUrl = customInfo[1];
			var functions = customInfo[2];
			var clientIp = customInfo[3];

			var checkFunction = functions[functions.length - 1]['function'],
				params = [];

			var i;
			for(i = 0;i < functions.length;i++) {
				var checkParams = functions[i]['param'];
				params.push(checkParams);
			}

			this.actualFunctions[checkFunction](clientIp, authentication, params, req.cookies, req.body, function(resData) {
				cb(resData);
			});
		} else {
			cb({ message: customInfo });
		}
	},

	actualFunctions: {}
};
