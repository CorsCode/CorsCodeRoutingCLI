'use strict';

var authenticationFunctions = require('./authenticationFunctions');

module.exports = {
	getFunction: function(x, dataVars, dataHooks) {
		return function(clientIp, authentication, ids, cookies, body, cb) {
			if(x === 0) {
				// Check if this is a registration route
				if(authentication === dataVars[x]) {
					// This is the registration route
					var tempSecret = authenticationFunctions.generateSecret();

					if(clientIp === '::ffff:127.0.0.1' || clientIp === '::1') clientIp = '::ffff:127.0.0.1'

					dataHooks[dataVars[x]].findOne({ ipAddr: clientIp, expires: true }, function(err, data) {
						if(err) cb(err);

						if(data) cb({ secret: data.secret, otpauth_url: authenticationFunctions.getOtpAuthLink(data.secret) });
						else {
							var newData = new dataHooks[dataVars[x]]({});

							newData.secret = tempSecret.base32;
							newData.ipAddr = clientIp;

							newData.save(function(err, data) {
								if(err) cb(err);

								cb({ secret: data.secret, otpauth_url: tempSecret.otpauth_url });
							});
						}
					});
				} else {
					// TODO: check if client is authenticated
					authenticationFunctions.validateAuthentication(authentication, (typeof cookies.publicAccessToken !== 'undefined' ? cookies.publicAccessToken : false), dataHooks[authentication], clientIp, function(resData) {
						if(resData && typeof resData.message !== 'undefined') cb(resData);
						else {
							var findData = {};
							if(ids[x] !== '') {
								findData = { _id: ids[x] };
							}

							dataHooks[dataVars[x]].find(findData, function(err, data) {
								if(err) cb(err);

								if(ids[x] !== '') {
									cb(data[0]);
								} else {
									cb(data);
								}
							});
						}
					});
				}
			} else {
				if(ids[x - 1] !== '' && typeof ids[x] !== 'undefined') {
					// TODO: check if client is authenticated
					authenticationFunctions.validateAuthentication(authentication, (typeof cookies.publicAccessToken !== 'undefined' ? cookies.publicAccessToken : false), dataHooks[authentication], clientIp, function(resData) {
						if(resData && typeof resData.message !== 'undefined') cb(resData);
						else {
							var findData = {};
							var prevId = dataVars[x - 1].slice(0, (dataVars[x - 1].substring(dataVars[x - 1].length - 1) === 's' ? dataVars[x - 1].length - 1 : dataVars[x - 1].length)) + 'Id';

							if(ids[x] === '') {
								findData['_id'] = ids[x - 1];

								var populateData;
								if(x - 1 === 0) {
									populateData = dataVars[x];
								} else {
									if(x > 1) {
										prevId = dataVars[x - 2].slice(0, (dataVars[x - 2].substring(dataVars[x - 2].length - 1) === 's' ? dataVars[x - 2].length - 1 : dataVars[x - 2].length)) + 'Id';
									}
									populateData = prevId + ' ' + dataVars[x];
								}

								dataHooks[dataVars[x - 1]].find(findData)
									.populate(populateData)
									.exec(function(err, data) {
										if(err) cb(err);

										cb(data);
									});
							} else {
								findData['_id'] = ids[x];

								dataHooks[dataVars[x]].find(findData)
									.populate(prevId)
									.exec(function(err, data) {
										if(err) cb(err);

										cb(data[0]);
									});
							}
						}
					});
				} else {
					cb({ message: 'There was an issue retrieving the request information.' });
				}
			}
		};
	},

	postFunction: function(x, dataVars, dataHooks) {
		var self = this;

		return function(clientIp, authentication, ids, cookies, body, cb) {
			if(ids[x] === '') {
				var newData = new dataHooks[dataVars[x]]({});

				if(x === 0) {
					// Check if this is an authentication route
					if(authentication === dataVars[x]) {
						if(typeof body['authentication'] !== 'undefined') {
							// This is the authentication route (EX login)
							dataHooks[dataVars[x]].findOne({ email: body['email'] }, function(err, data) {
								if(err) cb(err);

								// Verify token that client provides
								if(authenticationFunctions.verifyToken(body['token'], data.secret)) {
									data.publicAccessToken = authenticationFunctions.generatePublicAccessToken();

									data.save(function(err, data) {
										if(err) cb(err);

										cb({ data: data, cookies: { publicAccessToken: data.publicAccessToken } });
									});
								} else {
									cb({ message: 'Token not valid.' });
								}
							});
						} else {
							if(clientIp === '::ffff:127.0.0.1' || clientIp === '::1') clientIp = '::ffff:127.0.0.1'
							// This is the registration route
							dataHooks[dataVars[x]].findOne({ ipAddr: clientIp, expires: true }, function(err, data) {
								if(err) cb(err);

								if(data) {
									// Verify token that client provides
									if(authenticationFunctions.verifyToken(body['token'], data.secret)) {
										var a;
										for(a = 0;a < Object.keys(body).length;a++) {
											if(Object.keys(body)[a] !== 'token') {
												data[Object.keys(body)[a]] = body[Object.keys(body)[a]];
											}
										}

										data.publicAccessToken = authenticationFunctions.generatePublicAccessToken();
										data.expires = false;

										data.save(function(err, data) {
											if(err) cb(err);

											cb({ data: data, cookies: { publicAccessToken: data.publicAccessToken } });
										});
									} else {
										cb({ message: 'Token not valid.' });
									}
								} else {
									cb({ message: 'Entry not found.' });
								}
							});
						}
					} else {
						// TODO: check if client is authenticated
						authenticationFunctions.validateAuthentication(authentication, (typeof cookies.publicAccessToken !== 'undefined' ? cookies.publicAccessToken : false), dataHooks[authentication], clientIp, function(resData) {
							if(resData && typeof resData.message !== 'undefined') cb(resData);
							else {
								if(resData) {
									newData['createdBy'] = resData._id;
								}

								var i;
								for(i = 0;i < Object.keys(body).length;i++) {
									newData[Object.keys(body)[i]] = body[Object.keys(body)[i]];
								}

								newData.save(function(err, data) {
									if(err) cb(err);

									cb(data);
								});
							}							
						});
					}
				} else {
					// TODO: check if client is authenticated
					authenticationFunctions.validateAuthentication(authentication, (typeof cookies.publicAccessToken !== 'undefined' ? cookies.publicAccessToken : false), dataHooks[authentication], clientIp, function(resData) {
						if(resData && typeof resData.message !== 'undefined') cb(resData);
						else {
							if(resData) {
								newData['createdBy'] = resData._id;
							}

							// TODO: make sure only the user that created this data can alter it
							var prevId = dataVars[x - 1].slice(0, (dataVars[x - 1].substring(dataVars[x - 1].length - 1) === 's' ? dataVars[x - 1].length - 1 : dataVars[x - 1].length)) + 'Id';

							self.getFunction(x - 1, dataVars, dataHooks)(clientIp, false, ids, cookies, body, function(data) {
								body[prevId] = data._id;
								var prevData = data;

								var i;
								for(i = 0;i < Object.keys(body).length;i++) {
									newData[Object.keys(body)[i]] = body[Object.keys(body)[i]];
								}

								newData.save(function(err, data) {
									if(err) cb(err);

									prevData[dataVars[x]].push(data);

									prevData.save(function(err) {
										if(err) cb(err);

										cb(data);
									});
								});
							});
						}
					});
				}
			} else {
				cb({ message: 'What exactly are you posting to?' });
			}
		};
	},

	putFunction: function(x, dataVars, dataHooks) {
		var self = this;

		return function(clientIp, authentication, ids, cookies, body, cb) {
			if(ids[x] !== '') {
				// TODO: check if client is authenticated
				authenticationFunctions.validateAuthentication(authentication, (typeof cookies.publicAccessToken !== 'undefined' ? cookies.publicAccessToken : false), dataHooks[authentication], clientIp, function(resData) {
					if(resData && typeof resData.message !== 'undefined') cb(resData);
					else {
						if(resData) {
							dataHooks[dataVars[x]].findOne({ _id: ids[x] }, function(err, data) {
								if(err) cb(err);

								// Make sure only the user that created this data can alter it
								if((resData._id).toString() === (data.createdBy).toString() || (resData._id).toString() === (data._id).toString()) {
									dataHooks[dataVars[x]].update({ _id: ids[x] }, body, function(err, data) {
										if(err) cb(err);

										self.getFunction(x, dataVars, dataHooks)(clientIp, false, ids, cookies, body, function(data) {
											if(err) cb(err);

											cb(data);
										});
									});
								} else {
									cb({ message: 'Not authorized to modify data.' });
								}
							});
						} else {
							dataHooks[dataVars[x]].update({ _id: ids[x] }, body, function(err, data) {
								if(err) cb(err);

								self.getFunction(x, dataVars, dataHooks)(clientIp, false, ids, cookies, body, function(data) {
									if(err) cb(err);

									cb(data);
								});
							});
						}
					}
				});
			} else {
				cb({ message: 'What exactly are you updating?' });
			}
		};
	},

	deleteFunction: function(x, dataVars, dataHooks) {
		var self = this;

		return function(clientIp, authentication, ids, cookies, body, cb) {
			if(ids[x] !== '') {
				// TODO: check if client is authenticated
				authenticationFunctions.validateAuthentication(authentication, (typeof cookies.publicAccessToken !== 'undefined' ? cookies.publicAccessToken : false), dataHooks[authentication], clientIp, function(resData) {
					if(resData && typeof resData.message !== 'undefined') cb(resData);
					else {
						if(resData) {
							self.getFunction(x, dataVars, dataHooks)(clientIp, false, ids, cookies, body, function(data) {
								// Make sure only the user that created this data can delete it
								if((resData._id).toString() === (data.createdBy).toString() || (resData._id).toString() === (data._id).toString()) {
									data.remove(function(err) {
										if(err) cb(err);

										cb({ message: 'removed' });
									});
								} else {
									cb({ message: 'Not authorized to delete data.' });
								}
							});
						} else {
							self.getFunction(x, dataVars, dataHooks)(clientIp, false, ids, cookies, body, function(data) {
								data.remove(function(err) {
									if(err) cb(err);

									cb({ message: 'removed' });
								});
							});
						}
					}					
				});
			} else {
				cb({ message: 'What exactly are you trying to delete?' });
			}
		};
	}
};
