'use strict';

var jwt = require('jsonwebtoken'),
	Promise = require('bluebird');

function Authenticator(authenticationModel, appSecret) {
	this.authenticationModel = authenticationModel;
	this.secret = appSecret;
}

Authenticator.prototype.register = function(username, password, confirmPassword) {
	var self = this;

	return new Promise(function(resolve, reject) {
		self.authenticationModel.findOne({ username: username }, function(err, data) {
			if(err) reject(err);

			if(data) resolve('Username already exists.');

			if(password !== confirmPassword) resolve('Passwords do not match.');

			var newData = new self.authenticationModel({
				username: username,
				password: password
			});

			newData.save(function(err, data) {
				if(err) reject(err);

				resolve({ token: self.generateToken({ _id: data._id, username: data.username }) });
			});
		});
	});
};

Authenticator.prototype.login = function(username, password) {
	var self = this;

	return new Promise(function(resolve, reject) {
		self.authenticationModel.findOne({ username: username }, function(err, data) {
			if(err) reject(err);

			if(!data) resolve('Username does not exist');

			data.comparePassword(password, function(err, isMatch) {
				if(err) reject(err);

				if(!isMatch) resolve('Incorrect password.');

				resolve({ token: self.generateToken({ _id: data._id, username: data.username }) });
			});
		});
	});
};

Authenticator.prototype.generateToken = function(data) {
	return jwt.sign(data, this.secret, {
		expiresIn: '24h'
	});
};

Authenticator.prototype.verifyToken = function(token) {
	return jwt.verify(token, this.secret);
};

module.exports = Authenticator;
