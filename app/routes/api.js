module.exports = function(router, functionsToCall) {
	// Root API route (GET '/api/')
	router.get('/', (req, res) => {
		res.json({ message: 'Root for API.' });
	});

	router.all('*', function(req, res) {
		functionsToCall.enableRouter(req, res.locals.customInfo, require('../../package.json').authentication_route, function(data) {
			if(typeof data.cookies !== 'undefined') {
				var i;
				for(i = 0;i < Object.keys(data.cookies).length;i++) {
					res.cookie(Object.keys(data.cookies)[i], data.cookies[Object.keys(data.cookies)[i]]);
				}
			}

			res.json(typeof data.cookies !== 'undefined' ? { data: data.data } : { data: data });
		});
	});

	return router;
};
