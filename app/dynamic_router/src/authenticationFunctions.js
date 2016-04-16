'use strict';

var speakeasy = require('speakeasy');

module.exports = {
	randomString: function(length, chars) {
		var mask = '';
		if (chars.indexOf('a') > -1) mask += 'abcdefghijklmnopqrstuvwxyz';
		if (chars.indexOf('A') > -1) mask += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
		if (chars.indexOf('#') > -1) mask += '0123456789';
		if (chars.indexOf('!') > -1) mask += '~`!@#$%^&*()_+-={}[]:";\'<>?,./|\\';
		var i, result = '';
		for(i = length;i > 0;--i) result += mask[Math.floor(Math.random() * mask.length)];
		return result;
	},

	generatePublicAccessToken: function() {
		return this.randomString(32, 'aA#');
	},

	generateSecret: function() {
		return speakeasy.generateSecret();
	},

	generateTimeToken: function(secretBase32) {
		return speakeasy.totp({
			secret: secretBase32,
			encoding: 'base32'
		});
	},

	getOtpAuthLink: function(secret) {
		return 'otpauth://totp/SecretKey?secret=' + secret;
	},

	verifyToken: function(token, secret) {
		return speakeasy.totp.verify({
			secret: secret,
			encoding: 'base32',
			token: token
		});
	},

	validateAuthentication: function(authentication, publicAccessToken, dataToSearch, clientIp, cb) {
		if(authentication) {
			if(!publicAccessToken) cb({ message: 'No publicAccessToken found.' });
			else {
				dataToSearch.findOne({ publicAccessToken: publicAccessToken, ipAddr: clientIp }, function(err, data) {
					if(err) cb(err);

					if(!data) cb({ message: 'No user found.' });
					else {
						cb(data);
					}
				});
			}
		} else {
			cb(false);
		}
	}
};
