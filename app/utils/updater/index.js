'use strict';

var figlet = require('figlet'),
	chalk = require('chalk');

var model_updater = require('./lib/model_updater');

figlet('CorsCode CLI', function(err, data) {
	if(err) {
		console.log('Something went wrong...');
		console.dir(err);
		return;
	}

	console.log(chalk.green(data));

	model_updater.checkIfModelsNeedUpdate(function(done) {
		if(done) {
			process.exit();
		}
	});
});
