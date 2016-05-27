'use strict';

var Promise = require('bluebird'),
	fs = require('fs'),
	path = require('path'),
	co = require('co'),
	prompt = require('co-prompt');

var project_package = require('../../../package.json');

function exists(target) {
	try {
		fs.accessSync(target);
		return true;
	} catch(e) {
		return false;
	}
}

function Updater() {
	this.state = {
		promises: [],
		all_new_models: [],
		all_old_models: [],
		models_to_delete: [],
		models_to_create: [],
		unchanged_models: [],
		delete_counter: 0,
		hooks: {},
		main_fields: {}
	};
}

Updater.prototype.checkIfModelsNeedUpdate = function(cb) {
	var self = this;

	this.state.promises.push(this.getAllNewModels());
	this.state.promises.push(this.getAllOldModels());

	Promise.all(this.state.promises).then(function() {
		self.state.promises = [];
		self.compareModels().then(function(needed) {
			if(needed) {
				self.deleteModels().then(function() {
					self.state.models_to_delete = [];

					self.createModelStack(0, function() {
						self.createDataHooks(cb);
					});
				});
			} else cb(null, true);
		});
	});
};

Updater.prototype.createDataHooks = function(cb) {
	var prevHooks = null,
		self = this;

	//console.log(this.state.main_fields);
	// TODO: get prior data hooks from file, if it exists
	// ----- delete old hooks that no longer have models
	// ----- add old hooks still in use, and new hooks
	if(exists(path.resolve('./core/models/hooks.js'))) {
		prevHooks = fs.readFileSync(path.resolve('./core/models/hooks.js'), 'utf-8');
		var beginPrevHooks = prevHooks.indexOf('/* begin */');
		var endPrevHooks = prevHooks.indexOf('/* end */');

		prevHooks = prevHooks.substring(beginPrevHooks + ('/* begin */').length, endPrevHooks).split('/* middle */').map(function(hook) {
			return hook;
		});
	}

	// Create hooks after models are made
	try {
		var hooks = 'module.exports = function(mongoose) {\n\treturn {\n\t\t/* begin */\n';

		if(prevHooks) {
			prevHooks.map(function(hook) {
				hook = hook.replace(/\s/gm, '');
				var potMatch = hook.substring(0, hook.indexOf(':'));
				potMatch = potMatch.lastIndexOf('s') === potMatch.length - 1 ? potMatch.substring(0, potMatch.length - 1) : potMatch;

				if(self.state.unchanged_models.indexOf(potMatch) !== -1) {
					self.state.hooks[hook.substring(0, hook.indexOf(':'))] = { model: hook.substring(hook.indexOf('(') + 4, hook.indexOf(')') - 1) };

					self.state.main_fields[hook.substring(0, hook.indexOf(':'))] = hook.substring(hook.indexOf('main_field:') + ('main_field:').length + 1, hook.lastIndexOf('"'));
				}
			});
		}

		var i;
		for(i = 0;i < Object.keys(self.state.hooks).length;i++) {
			hooks += '\t\t' + Object.keys(self.state.hooks)[i] + ': {\n';
			hooks += '\t\t\tmodel: require("./' + self.state.hooks[Object.keys(self.state.hooks)[i]].model + '")(mongoose),\n';
			hooks += '\t\t\tmain_field: "' + self.state.main_fields[Object.keys(self.state.hooks)[i]] + '"\n';
			hooks += '\t\t}';
			if(i === Object.keys(self.state.hooks).length - 1) hooks += '\n';
			else hooks += ',/* middle */\n';
		}
		hooks += '\t\t/* end */\n\t};\n};\n';
	} catch(e) {
		console.log(e);
	} finally {
		fs.writeFile(path.resolve('./core/models/hooks.js'), hooks, 'utf-8', function(error) {
			if(error) return cb(error);

			process.exit();
		});
	}
};

Updater.prototype.compareModels = function() {
	var self = this;

	return new Promise(function(resolve) {
		var needed = false,
			new_models = self.state.all_new_models;
		new_models = new_models.map(function(models) {
			return models.map((model) => {
				return (model.lastIndexOf('s') === model.length - 1 ? model.substring(0, model.length - 1) : model);
			});
		});

		try {
			var i, x;
			for(i = 0;i < new_models.length;i++) {
				self.state.models_to_create[i] = [];
				for(x = 0;x < new_models[i].length;x++) {
					if(self.state.all_old_models.indexOf(new_models[i][x]) === -1) {
						needed = true;
						self.state.models_to_create[i].push(self.state.all_new_models[i][x]);
					}
				}
			}
			for(x = 0;x < new_models.length;x++) {
				for(i = 0;i < self.state.all_old_models.length;i++) {
					if(new_models[x].indexOf(self.state.all_old_models[i]) === -1) {
						self.state.delete_counter++;
						if(self.state.delete_counter > self.state.all_old_models.length) needed = true;
						self.state.models_to_delete.push(self.state.all_old_models[i]);
					} else {
						self.state.unchanged_models.push(self.state.all_old_models[i]);
					}
				}
			}
		} catch(e) {
			console.log(e);
		} finally {
			resolve(needed);
		};
	});
};

Updater.prototype.deleteModels = function() {
	var self = this;

	return new Promise(function(resolve) {
		var done = false,
			modelDir = path.join(__dirname, '../../../core/models');

		try {
			self.state.models_to_delete.map(function(model) {
				if(exists(path.resolve(path.join(modelDir, (model.charAt(0).toUpperCase() + model.slice(1)) + '.model.js'))) && self.state.unchanged_models.indexOf(model) === -1) fs.unlinkSync(path.resolve(path.join(modelDir, (model.charAt(0).toUpperCase() + model.slice(1)) + '.model.js')));
			})
		} catch(e) {
			console.log(e);
		} finally {
			resolve();
		}
	});
};

Updater.prototype.createModelStack = function (i, cb) {
	var self = this;

	this.createModel(i, 0, function() {
		if(i === self.state.models_to_create.length - 1) {
			cb();
		} else self.createModelStack(i + 1, cb);
	});
};

Updater.prototype.createModel = function(i, x, cb) {
	var model = this.state.models_to_create[i];
	if(model.length) {
		model = model[x];
		var self = this;

		console.log('\n' + model + ':');
		this.promptUser(function(fields) {
			// TODO: Create model with additional fields provided by user
			try {
				self.buildModel(self.state.models_to_create[i], model, fields);
			} catch(e) {
				console.log(e);
			} finally {
				if(x === self.state.models_to_create[i].length - 1) {
					cb();
				} else self.createModel(i, x + 1, cb);
			}
		});
	} else {
		cb();
	}
};

Updater.prototype.buildModel = function(models, model, fields) {
	// Modify model name to MODEL.model.js
	var modelName = (model.lastIndexOf('s') === model.length - 1) ? model.substring(0, model.length - 1) : model;
	modelName = modelName.charAt(0).toUpperCase() + modelName.slice(1);

	var mongooseModel = modelName;

	modelName += '.model.js';

	/**
	 * Model Content
	 */
	var modelContent = '';
	if(project_package.authenticationVar === model) {
		modelContent += 'var bcrypt = require("bcryptjs");\n\n';
	}

	modelContent += 'module.exports = function(mongoose) {\n';

	// Schema
	modelContent += '\tvar Schema = new mongoose.Schema({\n';
	if(project_package.authenticationVar === model) {
		modelContent += '\t\tusername: String,\n';
		modelContent += '\t\tpassword: String';
	} else {
		modelContent += '\t\tcreatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }';
	}

	var nextModel,
		prevModel;

	// Check the hierarchy of the models
	if(models.indexOf(model) === 0) { // First
		if(models.length > 1) {
			nextModel = (models[models.indexOf(model) + 1].lastIndexOf('s') === models[models.indexOf(model) + 1].length - 1) ? models[models.indexOf(model) + 1].substring(0, models[models.indexOf(model) + 1].length - 1) : models[models.indexOf(model) + 1];
			nextModel = nextModel.charAt(0).toUpperCase() + nextModel.slice(1);

			modelContent += ',\n\t\t' + models[models.indexOf(model) + 1] + ': [ { type: mongoose.Schema.Types.ObjectId, ref: "' + nextModel + '" } ]';
		}
	} else if(models.indexOf(model) === models.length - 1) { // Last
		prevModel = (models[models.indexOf(model) - 1].lastIndexOf('s') === models[models.indexOf(model) - 1].length - 1) ? models[models.indexOf(model) - 1].substring(0, models[models.indexOf(model) - 1].length - 1) : models[models.indexOf(model) - 1];

		modelContent += ',\n\t\t' + prevModel + 'Id: { type: mongoose.Schema.Types.ObjectId, ref: "' + (prevModel.charAt(0).toUpperCase() + prevModel.slice(1)) + '" }';
	} else { // Middle
		prevModel = (models[models.indexOf(model) - 1].lastIndexOf('s') === models[models.indexOf(model) - 1].length - 1) ? models[models.indexOf(model) - 1].substring(0, models[models.indexOf(model) - 1].length - 1) : models[models.indexOf(model) - 1];

		modelContent += ',\n\t\t' + prevModel + 'Id: { type: mongoose.Schema.Types.ObjectId, ref: "' + (prevModel.charAt(0).toUpperCase() + prevModel.slice(1)) + '" },\n';

		nextModel = (models[models.indexOf(model) + 1].lastIndexOf('s') === models[models.indexOf(model) + 1].length - 1) ? models[models.indexOf(model) + 1].substring(0, models[models.indexOf(model) + 1].length - 1) : models[models.indexOf(model) + 1];
		nextModel = nextModel.charAt(0).toUpperCase() + nextModel.slice(1);

		modelContent += '\t\t' + models[models.indexOf(model) + 1] + ': [ { type: mongoose.Schema.Types.ObjectId, ref: "' + nextModel + '" } ]';
	}

	var i;
	for(i = 0;i < Object.keys(fields).length;i++) {
		modelContent += ',\n\t\t' + Object.keys(fields)[i] + ': ' + (fields[Object.keys(fields)[i]].field_main ? '{ type: ' : '') + fields[Object.keys(fields)[i]].field_type + (fields[Object.keys(fields)[i]].field_main ? ', required: true }' : '');
		
		if(fields[Object.keys(fields)[i]].field_main) this.state.main_fields[model] = Object.keys(fields)[i];
	}

	modelContent += '\n\t});\n\n';

	// Pre-save
	if(project_package.authenticationVar === model) {
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

	function nextModelRemove() {
		// Pre-remove next model
		modelContent += '\t\tthis.model("' + nextModel + '").find({ ' + ((model.lastIndexOf('s') === model.length - 1) ? model.substring(0, model.length - 1) : model) + 'Id: this._id }, function(err, ' + models[models.indexOf(model) + 1] + ') {\n';

		modelContent += '\t\t\tif(err) throw err;\n';
		modelContent += '\t\t\t' + models[models.indexOf(model) + 1] + '.forEach(function(' + ((models[models.indexOf(model) + 1].lastIndexOf('s') === models[models.indexOf(model) + 1].length - 1) ? models[models.indexOf(model) + 1].substring(0, models[models.indexOf(model) + 1].length - 1) : models[models.indexOf(model) + 1]) + ') {\n';
		modelContent += '\t\t\t\t' + ((models[models.indexOf(model) + 1].lastIndexOf('s') === models[models.indexOf(model) + 1].length - 1) ? models[models.indexOf(model) + 1].substring(0, models[models.indexOf(model) + 1].length - 1) : models[models.indexOf(model) + 1]) + '.remove();\n';
		modelContent += '\t\t\t});\n';

		modelContent += '\t\t});\n';
	}
	function prevModelRemove() {
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
	}

	// Check the hierarchy of the models
	if(models.indexOf(model) === 0) { // First
		if(models.length > 1) {
			nextModelRemove();
		}
	} else if(models.indexOf(model) === models.length - 1) { // Last
		prevModelRemove();
	} else { // Middle
		prevModelRemove();

		nextModelRemove();
	}

	modelContent += '\t\tnext();\n\t});\n\n';

	if(project_package.authenticationVar === model) {
		modelContent += '\tSchema.methods.comparePassword = function(candidatePassword, cb) {\n';
		modelContent += '\t\tbcrypt.compare(candidatePassword, this.password, function(err, isMatch) {\n';
		modelContent += '\t\t\tif(err) return cb(err);\n\n';
		modelContent += '\t\t\tcb(null, isMatch);\n';
		modelContent += '\t\t});\n\t};\n\n';
	}

	modelContent += '\treturn mongoose.model("' + mongooseModel + '", Schema);\n};\n';

	fs.writeFileSync(path.resolve('./core/models/' + modelName), modelContent);

	this.state.hooks[model] = { model: modelName };
};

Updater.prototype.promptUser = function(cb) {
	var fields = {},
		answering = true,
		mainField = false;

	co(function* () {
		while(answering) {
			var field_name = yield prompt('\nField name: '),
				field_type = yield prompt('Field type:\n1. String\n2. Number\nWhich? ');

			var field_main = false;
			if(!mainField) {
				field_main = yield prompt.confirm('Is this the main field (Y/N)? ');

				if(field_main) mainField = true;
			}

			fields[field_name] = { field_type: (field_type === '1' ? 'String' : 'Number'), field_main: field_main };

			answering = yield prompt.confirm('\nWould you look to add another field (Y/N)? ');
		
			if(!answering) cb(fields);
		}
	});
};

Updater.prototype.getAllNewModels = function() {
	var self = this;

	return new Promise(function(resolve) {
		try {
			project_package.routes.map(function(route) {
				var sep_route = route.split('/'),
					models = sep_route.filter(function(ind_route) {
						return ind_route !== '' && ind_route.indexOf(':') === -1;
					});

				self.state.all_new_models.push(models);
			})
		} catch(e) {
			console.log(e);
		} finally {
			resolve();
		}
	});
};

Updater.prototype.getAllOldModels = function() {
	var self = this;

	return new Promise(function(resolve) {
		var modelDir = path.resolve(path.join(__dirname, '../../../core/models'));
		exists(modelDir) || fs.mkdirSync(modelDir);
		fs.readdir(modelDir, function(error, models) {
			if(error) console.log(error);

			try {
				models = models.filter(function(model) {
					return model.indexOf('.model.js') !== -1 && model.indexOf('.map') === -1;
				});

				models.map(function(model) {
					self.state.all_old_models.push(model.substring(0, model.indexOf('.model.js')).toLowerCase());
				});
			} catch(e) {
				console.log(e);
			} finally {
				resolve();
			}
		});
	});
};

module.exports = new Updater();
