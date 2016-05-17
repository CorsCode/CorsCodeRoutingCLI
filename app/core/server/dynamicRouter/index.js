'use strict';

var logger = require('../../../utils/logger');

var routeFunctions = require('./src/routeFunctions'),
	crudFunctions = require('./src/crudFunctions');

var Promise = require('bluebird');

function DynamicRouter(dataHooks, definedRoutes) {
	this.functions = new crudFunctions(dataHooks);
	this.definedRoutes = definedRoutes || {};
	this.actualFunctions = {};
}

DynamicRouter.prototype.getDefinedRoutes = function(routes) {
	var self = this;

	self.definedRoutes = routeFunctions.expandRoutes(routes);
};

DynamicRouter.prototype.setupMiddleware = function(authenticator) {
	var self = this;

	return new Promise(function(resolve) {
		self.defineDataVars().then(function(dataVars) {
			self.functions.setDataVars(dataVars);

			try {
				self.createFunctions('GET');
				self.createFunctions('POST');
				self.createFunctions('PUT');
				self.createFunctions('DELETE');
			} catch(e) {
				// Do nothing
			} finally {
				resolve(function(req, res, next) {
					res.locals.customInfo = routeFunctions.confirmRoutes(req.url, req.method, self.definedRoutes);

					if(req.method !== 'GET' && (req.url !== '/register' && req.url !== '/login')) {
						var token = req.body.token || req.query.token || req.headers['x-access-token'];

						if(token) {
							res.locals.customInfo.push(authenticator.verifyToken(token));
						} else {
							res.locals.customInfo = 'no token provided';
						}
					}

					next();
				});
			}
		});
	});
};

DynamicRouter.prototype.defineDataVars = function() {
	var definedRoutes = this.definedRoutes;
	var curKey, dataVars = {};

	return new Promise(function(resolve) {
		try {
			var i, x;
			for(i = 0;i < Object.keys(definedRoutes).length;i++) {
				curKey = Object.keys(definedRoutes)[i];
				dataVars[curKey] = [];

				var sepRoute = routeFunctions.deferRequest(definedRoutes[curKey][definedRoutes[curKey].length - 2]);

				for(x = 0;x < sepRoute.length;x += 2) {
					dataVars[curKey].push(sepRoute[x]);
				}
			}
		} catch(e) {
			// Do nothing
		} finally {
			resolve(dataVars);
		}
	});
};

DynamicRouter.prototype.createFunctions = function(reqMethod) {
	var self = this;

	self.defineFunctions(reqMethod).then(function(baseFunctions) {
		self.assignFunctions(reqMethod, baseFunctions).then(function(actualFunctions) {
			self.actualFunctions[reqMethod] = actualFunctions;

			logger.debug(reqMethod + ' functions created');
		});
	});
};

DynamicRouter.prototype.defineFunctions = function(reqMethod) {
	var definedRoutes = this.definedRoutes;
	var curKey, baseFunctions = {};

	return new Promise(function(resolve) {
		try {
			var i, x;
			for(i = 0;i < Object.keys(definedRoutes).length;i++) {
				curKey = Object.keys(definedRoutes)[i];
				baseFunctions[curKey] = [];

				var sepRoute = routeFunctions.deferRequest(definedRoutes[curKey][definedRoutes[curKey].length - 2]);

				for(x = 0;x < sepRoute.length;x += 2) {
					baseFunctions[curKey].push(reqMethod.toLowerCase() + (sepRoute[x].charAt(0).toUpperCase() + sepRoute[x].slice(1)));
				}
			}
		} catch(e) {
			// Do nothing
		} finally {
			resolve(baseFunctions);
		}
	});
};

DynamicRouter.prototype.assignFunctions = function(reqMethod, baseFunctions) {
	var definedRoutes = this.definedRoutes;
	var curKey, actualFunctions = {};

	var self = this;

	return new Promise(function(resolve) {
		try {
			var i, x;
			for(i = 0;i < Object.keys(definedRoutes).length;i++) {
				curKey = Object.keys(definedRoutes)[i];

				for(x = 0;x < baseFunctions[curKey].length;x++) {
					if(reqMethod === 'GET') {
						actualFunctions[baseFunctions[curKey][x]] = self.functions.getFunction(curKey, x);
					} else if(reqMethod === 'POST') {
						actualFunctions[baseFunctions[curKey][x]] = self.functions.postFunction(curKey, x);
					} else if(reqMethod === 'PUT') {
						actualFunctions[baseFunctions[curKey][x]] = self.functions.putFunction(curKey, x);
					} else if(reqMethod === 'DELETE') {
						actualFunctions[baseFunctions[curKey][x]] = self.functions.deleteFunction(curKey, x);
					}
				}
			}
		} catch(e) {
			// Do nothing
		} finally {
			resolve(actualFunctions);
		}
	});
};

DynamicRouter.prototype.enableRouter = function(req, authenticationVar, customInfo, cb) {
	if(customInfo !== 'no route found' && customInfo !== 'no token provided') {
		var reqMethod = customInfo[0];
		var functions = customInfo[1];
		var token = (typeof customInfo[2] !== 'undefined') ? customInfo[2] : 'no token';

		var checkFunction = functions[functions.length - 1]['function'],
			params = [];

		var i;
		for(i = 0;i < functions.length;i++) {
			var checkParams = functions[i]['param'];
			params.push(checkParams);
		}

		/**
		 * Check if valid route
		 * - No token and reqMethod is GET
		 * - Token
		 *   - checkFunction !== reqMethod + authenticationVar
		 *   - checkFunction === reqMethod + authenticationVar and reqMethod !== POST
		 */
		if(token) {
			if((token === 'no token' && reqMethod === 'GET') || (
				(token !== 'no token') && (
					((reqMethod + authenticationVar) !== checkFunction.toLowerCase()) ||
					((reqMethod + authenticationVar) === checkFunction.toLowerCase() && reqMethod !== 'POST')
				)
			)) {
				this.actualFunctions[reqMethod][checkFunction](params, authenticationVar, (token._id || null), req.body, function(resData) {
					cb(resData);
				});
			} else {
				cb({ message: 'Invalid routing option.' });
			}
		} else {
			cb({ message: 'Invalid token.' });
		}
	} else {
		cb({ message: customInfo });
	}
};

module.exports = DynamicRouter;
