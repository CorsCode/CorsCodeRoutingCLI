#! /usr/bin/env node --harmony

var fs = require('fs'),
	path = require('path');

var figlet = require('figlet'),
	chalk = require('chalk');

var _ = require('underscore');

var program = require('commander'),
	co = require('co'),
	prompt = require('co-prompt'),
	ncp = require('ncp').ncp,
	exec = require('child_process').exec;

/**
 * Utility functions
 */
function list(val) {
	return val.split(',');
}

ncp.limit = 16;

var cli_location;
if(process.argv[1].lastIndexOf('/') > 0) {
	cli_location = path.resolve(process.argv[1].substring(0, process.argv[1].lastIndexOf('/')));
} else {
	cli_location = path.resolve(process.argv[1].substring(0, process.argv[1].lastIndexOf('\\')));
}

figlet('CorsCode CLI', function(err, data) {
	if(err) {
		console.log('Something went wrong...');
		console.dir(err);
		return;
	}

	console.log(chalk.green(data));

	program
		.version('0.2.0')
		.option('-n, --app-name <name>', 'Name of application.')
		.option('-m, --mongoose-connection <moncon>', 'Connection link to use for mongoose')
		.option('-r, --routes <routes>', 'List of lowest hierarchal routes (EX: "/users/:user_id/posts/:post_id/comments"). Use comma to separate.', list)
		.option('-a, --authentication-link <authlink>', 'Link to be used for authentication purposes')
		.parse(process.argv);

	co(function *() {
		var appName = (!program.appName ? yield prompt(chalk.cyan('-') + chalk.yellow(' Enter name of application: ')) : program.appName),
			mongooseConnection = (!program.mongooseConnection ? yield prompt(chalk.cyan('-') + chalk.yellow(' Mongoose Connection link: ')) : program.mongooseConnection),
			routes = (!program.routes ? list(yield prompt(chalk.cyan('-') + chalk.yellow(' Routes (EX: "/users/:user_id/posts/:post_id/comments"), separate by commas: '))) : program.routes),
			authenticationLink = (!program.authenticationLink ? yield prompt(chalk.cyan('-') + chalk.yellow(' Link to be used for authentication purposes (EX: "/users"): ')) : program.authenticationLink);

		fs.readFile(path.resolve(cli_location + '/project_package.json'), 'utf-8', function(error, data) {
			if(error) return console.log(error);

			data = JSON.parse(data);

			data.name = appName.toLowerCase();
			data.mongoose_connection = mongooseConnection;
			data.routes = routes;
			data.authentication_link = authenticationLink;

			fs.writeFile(path.resolve('./package.json'), JSON.stringify(data, null, 2), 'utf-8', function(error) {
				if(error) return console.log(error);

				console.log(chalk.green('\npackage.json added!'));

				/**
				 * Add Dynamic Routing API to project
				 */
				ncp(path.resolve(cli_location + '/app'), path.resolve('./app'), function(error) {
					if(error) return console.log(error);

					console.log(chalk.green('Dynamic Routing API added!'));

					_.map(routes, function(route) {
						var sep_route = route.split('/');

						var models = _.filter(sep_route, function(ind_route) {
							return ind_route !== '' && (ind_route.indexOf(':') === -1);
						});

						var dataHooks = [];

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
							var modelContent = 'module.exports = function(mongoose) {\n';

							// Schema
							modelContent += '\tvar Schema = new mongoose.Schema({\n';
							if(authenticationLink.substring(1) === model) {
								modelContent += '\t\temail: String,\n';
								modelContent += '\t\tpublicAccessToken: String,\n';
								modelContent += '\t\tsecret: String,\n';
								modelContent += '\t\tipAddr: String,\n';
								modelContent += '\t\texpires: { type: Boolean, default: true },\n';
							} else {
								if(authenticationLink) {
									modelContent += '\t\tcreatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },\n';
								}
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

							modelContent += '\t});\n';

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

							modelContent += '\t\tnext();\n\t});\n';

							modelContent += '\treturn mongoose.model("' + mongooseModel + '", Schema);\n};\n';

							fs.writeFileSync(path.resolve('./app/models/' + modelName), modelContent);

							var returnData = {};
							returnData[model] = modelName;
							dataHooks.push(returnData);
						});

						// Create hooks after models are made
						var hooks = 'module.exports = function(mongoose) {\n\treturn {\n';
						_.map(dataHooks, function(hook) {
							hooks += '\t\t' + Object.keys(hook)[0] + ': require("./' + hook[Object.keys(hook)[0]] + '")(mongoose)';
							if(dataHooks.indexOf(hook) === dataHooks.length - 1) hooks += '\n';
							else hooks += ',\n';
						});
						hooks += '\t};\n};\n';

						fs.writeFile(path.resolve('./app/models/hooks.js'), hooks, 'utf-8', function(error) {
							if(error) return console.log(error);

							console.log(chalk.green('Models and data hooks added!'));

							/**
							 * Run npm install for project
							 */
							console.log(chalk.yellow('Installing dependencies...'));
							exec('npm install', function(error, stdout, stderr) {
								if(error) return console.log(error);

								console.log(stdout);

								console.log(chalk.green('Dependencies installed!'));

								process.exit();
							});
						});
					});
				});
			});
		});
	});
});
