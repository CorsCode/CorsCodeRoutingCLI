var cluster = require('cluster');

if(cluster.isMaster) {
	// Count machine's CPUs
	var cpuCount = require('os').cpus().length;

	// Create a worker for each CPU
	var i;
	for(i = 0;i < cpuCount;i++) {
		cluster.fork();
	}

	// Listen for dying workers
	cluster.on('exit', function() {
		cluster.fork();
	});
} else {
	require('./index');
}
