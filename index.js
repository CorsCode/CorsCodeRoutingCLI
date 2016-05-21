#! /usr/bin/env node --harmony

var fs = require('fs'),
	path = require('path');

var figlet = require('figlet'),
	chalk = require('chalk');

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
		.version('0.3.0')
		.option('-n, --app-name <name>', 'Name of application.')
		.option('-m, --mongoose-connection <moncon>', 'Connection link to use for mongoose')
		.option('-r, --routes <routes>', 'List of lowest hierarchal routes (EX: "/users/:user_id/posts/:post_id/comments"). Use comma to separate.', list)
		.option('-a, --authentication-var <authlink>', 'Variable to be used for authentication purposes')
		.parse(process.argv);

	co(function *() {
		var appName = (!program.appName ? yield prompt(chalk.cyan('-') + chalk.yellow(' Enter name of application: ')) : program.appName),
			mongooseConnection = (!program.mongooseConnection ? yield prompt(chalk.cyan('-') + chalk.yellow(' Mongoose Connection link: ')) : program.mongooseConnection),
			routes = (!program.routes ? list(yield prompt(chalk.cyan('-') + chalk.yellow(' Routes (EX: "/users/:user_id/posts/:post_id/comments"), separate by commas: '))) : program.routes),
			authenticationVar = (!program.authenticationVar ? yield prompt(chalk.cyan('-') + chalk.yellow(' Variable to be used for authentication purposes (EX: "users"): ')) : program.authenticationVar);
	
		fs.readFile(path.resolve(cli_location + '/project_package.json'), 'utf-8', function(error, data) {
			if(error) return console.log(error);

			data = JSON.parse(data);

			data.name = appName.toLowerCase();
			data.mongoose_connection = mongooseConnection;
			data.routes = routes;
			data.authenticationVar = authenticationVar;

			fs.writeFile(path.resolve('./package.json'), JSON.stringify(data, null, 2), 'utf-8', function(error) {
				if(error) return console.log(error);

				console.log(chalk.green('\npackage.json added!'));

				/**
				 * Add Dynamic Routing API to project
				 */
				ncp(path.resolve(cli_location + '/app'), path.resolve('./'), function(error) {
					if(error) return console.log(error);

					console.log(chalk.green('Dynamic Routing API added!'));

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
