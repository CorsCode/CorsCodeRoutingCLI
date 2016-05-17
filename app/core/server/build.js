'use strict';

function server(options) {
	this.rootApp = options.rootApp;
	this.connections = {};
	this.connectionId = 0;

	this.logger = require('../../utils/logger');

	this.server = null;
}

server.prototype.start = function(app) {
	var self = this,
		rootApp = app ? app : self.rootApp;

	return new Promise(function(resolve) {
		self.server = rootApp.listen(rootApp.get('port'));
		self.server.on('connection', self.connection.bind(self));
		self.server.on('listening', function() {
			self.logger.info("Listening on port " + rootApp.get('port'));
			resolve(self);
		});
	});
};

server.prototype.connection = function(socket) {
	var self = this;

	self.connectionId += 1;
	socket._serverId = self.connectionId;

	socket.on('close', function() {
		delete self.connections[this._serverId];
	});

	self.connections[socket._serverId] = socket;
};

module.exports = server;
