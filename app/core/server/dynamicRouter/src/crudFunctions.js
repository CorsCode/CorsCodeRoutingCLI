'use strict';

function CRUDFunctions(dataHooks) {
	this.dataHooks = dataHooks;
	this.dataVars = {};
}

CRUDFunctions.prototype.setDataVars = function(dataVars) {
	this.dataVars = dataVars;
};

CRUDFunctions.prototype.getFunction = function(curKey, x) {
	var dataVar = this.dataVars[curKey][x],
		self = this;

	return function(ids, authenticationVar, authenticationId, body, cb) {
		if(x === 0) {
			var findData = {};
			if(ids[x] !== '') {
				findData = { _id: ids[x] };
			}

			self.dataHooks[dataVar].find(findData, function(err, data) {
				if(err) return cb(err);

				if(ids[x] !== '') {
					cb(data[0]);
				} else {
					cb(data);
				}
			});
		} else {
			if(ids[x - 1] !== '' && typeof ids[x] !== 'undefined') {
				var findData = {};
				var prevId = self.dataVars[curKey][x - 1].slice(0, (self.dataVars[curKey][x - 1].substring(self.dataVars[curKey][x - 1].length - 1) === 's' ? self.dataVars[curKey][x - 1].length - 1 : self.dataVars[curKey][x - 1].length)) + 'Id';

				if(ids[x] === '') {
					findData['_id'] = ids[x - 1];

					var populateData;
					if(x - 1 === 0) {
						populateData = self.dataVars[curKey][x];
					} else {
						if(x > 1) {
							prevId = self.dataVars[curKey][x - 2].slice(0, (self.dataVars[curKey][x - 2].substring(self.dataVars[curKey][x - 2].length - 1) === 's' ? self.dataVars[curKey][x - 2].length - 1 : self.dataVars[curKey][x - 2].length)) + 'Id';
						}
						populateData = prevId + ' ' + self.dataVars[curKey][x];
					}

					self.dataHooks[self.dataVars[curKey][x - 1]].find(findData)
						.populate(populateData)
						.exec(function(err, data) {
							if(err) return cb(err);

							cb(data);
						});
				} else {
					findData['_id'] = ids[x];

					self.dataHooks[self.dataVars[curKey][x]].find(findData)
						.populate(prevId)
						.exec(function(err, data) {
							if(err) return cb(err);

							cb(data[0]);
						});
				}
			} else {
				cb({ message: 'There was an issue retrieving the request information.' });
			}
		}
	};
};

CRUDFunctions.prototype.postFunction = function(curKey, x) {
	var dataVar = this.dataVars[curKey][x],
		self = this;

	return function(ids, authenticationVar, authenticationId, body, cb) {
		if(ids[x] === '') {
			var newData = new self.dataHooks[dataVar]({
				'createdBy': authenticationId
			});

			if(x === 0) {
				var i;
				for(i = 0;i < Object.keys(body).length;i++) {
					newData[Object.keys(body)[i]] = body[Object.keys(body)[i]];
				}

				newData.save(function(err, data) {
					if(err) return cb(err);

					cb(data);
				});
			} else {
				if(authenticationVar === curKey && ids[0] !== authenticationId) return cb({ message: 'Not your account to create things on.' });

				var prevId = self.dataVars[curKey][x - 1].slice(0, (self.dataVars[curKey][x - 1].substring(self.dataVars[curKey][x - 1].length - 1) === 's' ? self.dataVars[curKey][x - 1].length - 1 : self.dataVars[curKey][x - 1].length)) + 'Id';

				self.getFunction(curKey, x - 1)(ids, authenticationVar, authenticationId, body, function(data) {
					body[prevId] = data._id;
					var prevData = data;
					
					var i;
					for(i = 0;i < Object.keys(body).length;i++) {
						newData[Object.keys(body)[i]] = body[Object.keys(body)[i]];
					}

					newData.save(function(err, data) {
						if(err) return cb(err);

						prevData[dataVar].push(data);

						prevData.save(function(err) {
							if(err) return cb(err);

							cb(data);
						});
					});
				});
			}
		} else {
			cb({ message: 'What exactly are you posting to?' });
		}
	};
};

CRUDFunctions.prototype.putFunction = function(curKey, x) {
	var dataVar = this.dataVars[curKey][x],
		self = this;

	return function(ids, authenticationVar, authenticationId, body, cb) {
		if(ids[x] !== '') {
			self.dataHooks[dataVar].findOne({ _id: ids[x] }, function(err, data) {
				if(err) return cb(err);

				if(authenticationId.toString() === data.createdBy.toString() || authenticationId.toString() === data._id.toString()) {
					self.dataHooks[dataVar].update({ _id: ids[x] }, body, function(err, data) {
						if(err) return cb(err);

						self.getFunction(curKey, x)(ids, authenticationVar, authenticationId, body, function(data) {
							if(err) return cb(err);

							cb(data);
						});
					});
				} else {
					cb({ message: 'Not authorized to modify data.' });
				}
			});
		} else {
			cb({ message: 'What exactly are you updating?' });
		}
	};
};

CRUDFunctions.prototype.deleteFunction = function(curKey, x) {
	var dataVar = this.dataVars[curKey][x],
		self = this;

	return function(ids, authenticationVar, authenticationId, body, cb) {
		if(ids[x] !== '') {
			self.getFunction(curKey, x)(ids, authenticationVar, authenticationId, body, function(data) {
				if(authenticationId.toString() === data.createdBy.toString() || authenticationId.toString() === data._id.toString()) {
					data.remove(function(err) {
						if(err) return cb(err);

						cb({ message: 'removed' });
					});
				} else {
					cb({ message: 'Not authorized to delete data.' });
				}
			});
		} else {
			cb({ message: 'What exactly are you trying to delete?' });
		}
	};
};

module.exports = CRUDFunctions;
