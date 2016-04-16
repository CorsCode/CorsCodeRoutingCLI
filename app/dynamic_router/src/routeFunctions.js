'use strict';

module.exports = {
	/**
	 * This resource function is called to strip an array of sepecified values
	 *
	 * @param Array arr
	 * ------ An array to delete specified values from
	 * ------ EXAMPLE: [ "", "users", "", ":user_id", "", "posts", "", ":post_id", "", "comments", "", ":comment_id" ]
	 *
	 * @param deleteValue
	 * ------ EXAMPLE: ""
	 *
	 * @return Array
	 * ------ EXAMPLE: [ , "users", , ":user_id", , "posts", , ":post_id", , "comments", , ":comment_id" ]
	 *
	 *
	 * NOTE:
	 * This function will have to be called again to clear undefined values.
	 */
	cleanArray: function(arr, deleteValue) {
		var i;
		for(i = 0;i < arr.length;i++) {
			if(arr[i] === deleteValue) {
				arr.splice(i, 1);
				i--;
			}
		}

		return arr;
	},
	/**
	 * This resource function is called to seperate a string route into an array.
	 *
	 * @param String route
	 * ------ A URL string
	 * ------ EXAMPLE: "/users/:user_id/posts/:post_id/comments/:comment_id"
	 *
	 * @return Array
	 * ------ EXAMPLE: [ "users", ":user_id", "posts", ":post_id", "comments", ":comment_id" ]
	 */
	deferRequest: function(url) {
		var sep = this.cleanArray(url.split('/'), '');
		sep = this.cleanArray(sep, undefined);

		return sep;
	},
	/**
	 * This resource function does the complete opposite of deferRequest.
	 *
	 * @param Array
	 * ------ EXAMPLE: [ "users", ":user_id", "posts", ":post_id", "comments", ":comment_id" ]
	 *
	 * @return String route
	 * ------ A URL string
	 * ------ EXAMPLE: "/users/:user_id/posts/:post_id/comments/:comment_id"
	 */
	rebuildRequest: function(routes) {
		var route = '';

		var i;
		for(i = 0;i < routes.length;i++) {
			route += '/' + routes[i];
		}

		return route;
	},
	/**
	 * This resource function is called to expand the defined routes.
	 *
	 * @param Array routes
	 * ------ An array of top-level hierarchical routes
	 * ------ EXAMPLE: [ "/users/:user_id/posts/:post_id/comments/:comment_id",
	 * ------            "/restaurants/:restaurant_id/food/:food_id/reviews/:review_id" ]
	 *
	 * @return Object
	 * ------ Contains entire hierarchy of routes
	 * ------ EXAMPLE: { "users": [ "/users",
	 *								"/users/:user_id",
	 *								"/users/:user_id/posts",
	 *								"/users/:user_id/posts/:post_id",
	 *								"/users/:user_id/posts/:post_id/comments",
	 *								"/users/:user_id/posts/:post_id/comments/:comment_id" ],
	 *					 "restaurants": [ "/restaurants",
	 *					 				  "/restaurants/:restaurant_id",
	 *					 				  "/restaurants/:restaurant_id/food",
	 *					 				  "/restaurants/:restaurant_id/food/:food_id",
	 *					 				  "/restaurants/:restaurant_id/food/:food_id/reviews",
	 *					 				  "/restaurants/:restaurant_id/food/:food_id/reviews/:review_id" ] }
	 */
	expandRoutes: function(routes) {
		var newRoutes = {};

		var x;
		for(x = 0;x < routes.length;x++) {
			var sepRoutes = this.deferRequest(routes[x]);
			var curRoute = '';

			var i;
			for(i = 0;i < sepRoutes.length;i++) {
				if(i === 0) {
					curRoute = '/' + sepRoutes[i];
					newRoutes[sepRoutes[i]] = ['/' + sepRoutes[i]];
				} else {
					curRoute += '/' + sepRoutes[i];
					newRoutes[sepRoutes[0]].push(curRoute);
				}
			}
		}

		return newRoutes;
	},
	/**
	 * This resource function ensures the route being called is valid.
	 *
	 * @param String url
	 * ------ Actual URL being requested
	 * ------ EXAMPLE: "/users/:user_id"
	 *
	 * @param String method
	 * ------ Request method
	 * ------ EXAMPLE: "GET"
	 *
	 * @params Object definedRoutes
	 * ------- Routes created by expandRoutes
	 * ------- EXAMPLE: { "users": [ "/users",
	 *								"/users/:user_id",
	 *								"/users/:user_id/posts",
	 *								"/users/:user_id/posts/:post_id",
	 *								"/users/:user_id/posts/:post_id/comments",
	 *								"/users/:user_id/posts/:post_id/comments/:comment_id" ],
	 *					 "restaurants": [ "/restaurants",
	 *					 				  "/restaurants/:restaurant_id",
	 *					 				  "/restaurants/:restaurant_id/food",
	 *					 				  "/restaurants/:restaurant_id/food/:food_id",
	 *					 				  "/restaurants/:restaurant_id/food/:food_id/reviews",
	 *					 				  "/restaurants/:restaurant_id/food/:food_id/reviews/:review_id" ] }
	 *
	 * @return Array
	 * ------ This the customInfo array
	 */
	confirmRoutes: function(url, method, definedRoutes) {
		var sepUrl = this.deferRequest(url);

		//------------------------------------------------------------------
		// This section will break down the possible route, and replace any portions beginning
		// with a colon with the actual route params.
		var possibleRoute;
		if(!definedRoutes[sepUrl[0]]) possibleRoute = 'no route found';
		else {
			var x;
			for(x = 0;x < definedRoutes[sepUrl[0]].length;x++) {
				if(this.deferRequest(definedRoutes[sepUrl[0]][x]).length === sepUrl.length) {
					possibleRoute = definedRoutes[sepUrl[0]][x];
				}
			}

			if(!possibleRoute) possibleRoute = 'no route found';
			else {
				possibleRoute = this.deferRequest(possibleRoute);

				if(possibleRoute.length > 1) {
					var y;
					for(y = 1;y < possibleRoute.length;y += 2) {
						possibleRoute[y] = sepUrl[y];
					}
				}
			}
		}
		//------------------------------------------------------------------

		// This section confirms whether the possible route and the actual route are the same.
		if(this.rebuildRequest(sepUrl) === this.rebuildRequest(possibleRoute)) {
			var reqMethod = method;

			var functions = [];

			var i;
			for(i = 0;i < sepUrl.length;i += 2) {
				var individual = '';
				if(typeof sepUrl[i + 1] !== 'undefined') individual = sepUrl[i + 1];

				functions.push({ function: reqMethod.toLowerCase() + (sepUrl[i].charAt(0).toUpperCase() + sepUrl[i].slice(1)), param: individual });
			}

			return [ reqMethod, sepUrl, functions ];
		} else {
			return 'no route found';
		}
	}
};
