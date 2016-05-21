var Promise = require('bluebird'),
	_ = require('underscore'),
	fs = require('fs'),
	path = require('path');

var package = require('../package.json');

function Updater() {}

Updater.prototype.checkModels = function() {
	var self = this;
	return new Promise(function(resolve, reject) {
		var new_models = [],
			old_models = [],
			needed = false;

		_.map(package.routes, function(route) {
			var sep_route = route.split('/');
			sep_route = _.filter(sep_route, function(ind_route) {
				return ind_route !== '' && (ind_route.indexOf(':') === -1);
			});

			_.map(sep_route, function(ind_route) {
				new_models.push(ind_route.lastIndexOf('s') === ind_route.length - 1 ? ind_route.substring(0, ind_route.length - 1) : ind_route);
			});
		});

		fs.readdir(path.resolve(path.join(__dirname, '../core/models')), function(error, models) {
			if(error) reject(error);

			try {
				models = _.filter(models, function(model) {
					return model.indexOf('.model.js') !== -1;
				});

				_.map(models, function(model) {
					old_models.push(model.substring(0, model.indexOf('.model.js')).toLowerCase());
				});

				var i;
				for(i = 0;i < new_models.length;i++) {
					if(old_models.indexOf(new_models[i]) === -1) needed = true;
				}
				for(i = 0;i < old_models.length;i++) {
					if(new_models.indexOf(old_models[i]) === -1) needed = true;
				}
			} catch(e) {
				// Do nothing
			} finally {
				if(needed) {
					self.updateModels().then(function(done) {
						resolve(done);
					});
				} else {
					resolve(true);
				}
			}
		});
	});
};

Updater.prototype.updateModels = function() {
	return new Promise(function(resolve, reject) {
		var dataHooks = [];

		_.map(package.routes, function(route) {
			var sep_route = route.split('/'),
				models = _.filter(sep_route, function(ind_route) {
					return ind_route !== '' && (ind_route.indexOf(':') === -1);
				});

			_.map(models, function(model) {
				// Modify model name to MODEL.model.js
				var modelName;
				modelName = (model.lastIndexOf('s') === model.length - 1) ? model.substring(0, model.length - 1) : model;
				modelName = modelName.charAt(0).toUpperCase() + modelName.slice(1);

				var mongooseModel = modelName;

				modelName += '.model.js';

				/**
				 * Model Content
				 */
				var modelContent = '';
				if(package.authenticationVar === model) {
					modelContent += 'var bcrypt = require("bcryptjs");\n\n';
				}

				modelContent += 'module.exports = function(mongoose) {\n';

				// Schema
				modelContent += '\tvar Schema = new mongoose.Schema({\n';
				if(package.authenticationVar === model) {
					modelContent += '\t\tusername: String,\n';
					modelContent += '\t\tpassword: String,\n';
				} else {
					modelContent += '\t\tcreatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },\n';
				}

				var nextModel,
					prevModel;

				// Check the hierarchy of the models
				if(models.indexOf(model) === 0) { // First
					if(models.length > 1) {
						nextModel =(models[1].lastIndexOf('s') === models[1].length - 1) ? models[1].substring(0, models[1].length - 1) : models[1];
						nextModel = nextModel.charAt(0).toUpperCase() + nextModel.slice(1);

						modelContent += '\t\t' + models[1] + ': [ { type: mongoose.Schema.Types.ObjectId, ref: "' + nextModel + '" } ]\n';
					}
				} else if(models.indexOf(model) === models.length - 1) { // Last
					prevModel = (models[models.length - 2].lastIndexOf('s') === models[models.length - 2].length - 1) ? models[models.length - 2].substring(0, models[models.length - 2].length - 1) : models[models.length - 2];

					modelContent += '\t\t' + prevModel + 'Id: { type: mongoose.Schema.Types.ObjectId, ref: "' + (prevModel.charAt(0).toUpperCase() + prevModel.slice(1)) + '" }\n';
				} else { // Middle
					prevModel = (models[models.indexOf(model) - 1].lastIndexOf('s') === models[models.indexOf(model) - 1].length - 1) ? models[models.indexOf(model) - 1].substring(0, models[models.indexOf(model) - 1].length - 1) : models[models.indexOf(model) - 1];

					modelContent += '\t\t' + prevModel + 'Id: { type: mongoose.Schema.Types.ObjectId, ref: "' + (prevModel.charAt(0).toUpperCase() + prevModel.slice(1)) + '" },\n';

					nextModel = (models[models.indexOf(model) + 1].lastIndexOf('s') === models[models.indexOf(model) + 1].length - 1) ? models[models.indexOf(model) + 1].substring(0, models[models.indexOf(model) + 1].length - 1) : models[models.indexOf(model) + 1];
					nextModel = nextModel.charAt(0).toUpperCase() + nextModel.slice(1);

					modelContent += '\t\t' + models[models.indexOf(model) + 1] + ': [ { type: mongoose.Schema.Types.ObjectId, ref: "' + nextModel + '" } ]\n';
				}
				modelContent += '\t});\n\n';

				// Pre-save
				if(package.authenticationVar === model) {
					modelContent += '\tSchema.pre("save", function(next) {\n';

					modelContent += '\t\tvar data = this;\n';
					modelContent += '\t\tif(!data.isModified("password")) return next();\n\n';
					modelContent += '\t\tbcrypt.genSalt(10, function(err, salt) {\n';
					modelContent += '\t\t\tif(err) return next(err);\n\n';
					modelContent += '\t\t\tbcrypt.hash(data.password, salt, function(err, hash) {\n';
					modelContent += '\t\t\t\tif(err) return next(err);\n\n';
					modelContent += '\t\t\t\tdata.password = hash;\n\n';
					modelContent += '\t\t\t\tnext();\n';
					modelContent += '\t\t\t});\n\t\t});\n\t});\n\n';
				}

				// Pre-remove
				modelContent += '\tSchema.pre("remove", function(next) {\n';

				// Check the hierarchy of the models
				if(models.indexOf(model) === 0) { // First
					if(models.length > 1) {
						// Pre-remove next model
						modelContent += '\t\tthis.model("' + nextModel + '").find({ ' + ((models[0].lastIndexOf('s') === models[0].length - 1) ? models[0].substring(0, models[0].length - 1) : models[0]) + 'Id: this._id }, function(err, ' + models[1] + ') {\n';

						modelContent += '\t\t\tif(err) throw err;\n';
						modelContent += '\t\t\t' + models[1] + '.forEach(function(' + ((models[1].lastIndexOf('s') === models[1].length - 1) ? models[1].substring(0, models[1].length - 1) : models[1]) + ') {\n';
						modelContent += '\t\t\t\t' + ((models[1].lastIndexOf('s') === models[1].length - 1) ? models[1].substring(0, models[1].length - 1) : models[1]) + '.remove();\n';
						modelContent += '\t\t\t});\n';

						modelContent += '\t\t});\n';
					}
				} else if(models.indexOf(model) === models.length - 1) { // Last
					// Pre-remove previous model
					modelContent += '\t\tvar self = this;\n';
					modelContent += '\t\tvar id = (typeof this.' + prevModel.toLowerCase() + 'Id._id === "undefined" ? this.' + prevModel.toLowerCase() + 'Id : this.' + prevModel.toLowerCase() + 'Id._id)\n';
					modelContent += '\t\tthis.model("' + (prevModel.charAt(0).toUpperCase() + prevModel.slice(1)) + '").findById(id, function(err, ' + prevModel.toLowerCase() + ') {\n';

					modelContent += '\t\t\tif(err) throw err;\n';
					modelContent += '\t\t\tif(' + prevModel.toLowerCase() + ' !== null) {\n';
					modelContent += '\t\t\t\t' + prevModel.toLowerCase() + '.' + model + '.pull({ _id: self._id });\n';
					modelContent += '\t\t\t\t' + prevModel.toLowerCase() + '.save(next);\n';
					modelContent += '\t\t\t} else {\n\t\t\t\tnext();\n\t\t\t}\n';

					modelContent += '\t\t});\n';
				} else { // Middle
					// Pre-remove previous model
					modelContent += '\t\tvar self = this;\n';
					modelContent += '\t\tvar id = (typeof this.' + prevModel.toLowerCase() + 'Id._id === "undefined" ? this.' + prevModel.toLowerCase() + 'Id : this.' + prevModel.toLowerCase() + 'Id._id)\n';
					modelContent += '\t\tthis.model("' + (prevModel.charAt(0).toUpperCase() + prevModel.slice(1)) + '").findById(id, function(err, ' + prevModel.toLowerCase() + ') {\n';

					modelContent += '\t\t\tif(err) throw err;\n';
					modelContent += '\t\t\tif(' + prevModel.toLowerCase() + ' !== null) {\n';
					modelContent += '\t\t\t\t' + prevModel.toLowerCase() + '.' + model + '.pull({ _id: self._id });\n';
					modelContent += '\t\t\t\t' + prevModel.toLowerCase() + '.save(next);\n';
					modelContent += '\t\t\t} else {\n\t\t\t\tnext();\n\t\t\t}\n';

					modelContent += '\t\t});\n';

					// Pre-remove next model
					modelContent += '\t\tthis.model("' + nextModel + '").find({ ' + ((model.lastIndexOf('s') === model.length - 1) ? model.substring(0, model.length - 1) : model) + 'Id: this._id }, function(err, ' + models[models.indexOf(model) + 1] + ') {\n';

					modelContent += '\t\t\tif(err) throw err;\n';
					modelContent += '\t\t\t' + models[models.indexOf(model) + 1] + '.forEach(function(' + ((models[models.indexOf(model) + 1].lastIndexOf('s') === models[models.indexOf(model) + 1].length - 1) ? models[models.indexOf(model) + 1].substring(0, models[models.indexOf(model) + 1].length - 1) : models[models.indexOf(model) + 1]) + ') {\n';
					modelContent += '\t\t\t\t' + ((models[models.indexOf(model) + 1].lastIndexOf('s') === models[models.indexOf(model) + 1].length - 1) ? models[models.indexOf(model) + 1].substring(0, models[models.indexOf(model) + 1].length - 1) : models[models.indexOf(model) + 1]) + '.remove();\n';
					modelContent += '\t\t\t});\n';

					modelContent += '\t\t});\n';
				}

				modelContent += '\t\tnext();\n\t});\n\n';

				if(package.authenticationVar === model) {
					modelContent += '\tSchema.methods.comparePassword = function(candidatePassword, cb) {\n';
					modelContent += '\t\tbcrypt.compare(candidatePassword, this.password, function(err, isMatch) {\n';
					modelContent += '\t\t\tif(err) return cb(err);\n\n';
					modelContent += '\t\t\tcb(null, isMatch);\n';
					modelContent += '\t\t});\n};\n\n';
				}

				modelContent += '\treturn mongoose.model("' + mongooseModel + '", Schema);\n};\n';

				fs.writeFileSync(path.resolve('./core/models/' + modelName), modelContent);

				var returnData = {};
				returnData[model] = modelName;
				dataHooks.push(returnData);
			});
		});

		// Create hooks after models are made
		var hooks = 'module.exports = function(mongoose) {\n\treturn {\n';
		_.map(dataHooks, function(hook) {
			hooks += '\t\t' + Object.keys(hook)[0] + ': require("./' + hook[Object.keys(hook)[0]] + '")(mongoose)';
			if(dataHooks.indexOf(hook) === dataHooks.length - 1) hooks += '\n';
			else hooks += ',\n';
		});
		hooks += '\t};\n};\n';

		fs.writeFile(path.resolve('./core/models/hooks.js'), hooks, 'utf-8', function(error) {
			if(error) reject(error);

			resolve(true);
		});
	});
};

module.exports = new Updater();
