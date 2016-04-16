/**
 * Dependencies
 */
var express = require('express'),
	mongoose = require('mongoose'),
	path = require('path');

var app = express();

var functionsToCall = require('./dynamic_router');

mongoose.connect(require('../package.json').mongoose_connection);

/**
 * Data hooks
 */
var hooks = require('./models/hooks.js')(mongoose);

/**
 * Load configuration
 */
require('./configuration')(app, path);

/**
 * Routes Setup
 */
// Defined Routes
var definedRoutes = functionsToCall.getDefinedRoutes(require('../package.json').routes);

// Create api router
var apiRouter = express.Router();
// API router middleware
functionsToCall.setupMiddleware(apiRouter, definedRoutes, hooks);

/**
 * Routes
 */
// API Routes
require('./routes/api')(apiRouter, functionsToCall);

// Set basename for API
app.use('/api', apiRouter)

/**
 * Run Server
 */
app.listen(app.get('port'), () => {
	console.log('Magic is happening on http://localhost:' + app.get('port'))
})
