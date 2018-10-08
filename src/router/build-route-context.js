import { betterResult as result } from 'bbmn-utils';

function get(router, opts = {}, key, update){
	
	let value = result(opts, key, { context: router, args:[ router ] });
	if(value == null) {
		value = router.getOption(key, {args: [ router ]});
		if(update)
			opts[key] = value;
	}
	return value;		
}

// converts route method arguments to plain object;
// _normalizeRegisterRouteArguments
// { route, rawRoute, callback, name }
export default function routeArgumentsToObject(router, route, name, callback, opts = {}){

	let context = {};

	if(_.isObject(route)){
		context = route;

		//then second argument is probably options;
		_.extend(opts, name);

	} else if (_.isFunction(name)) {
		_.extend(context, { route, callback: name, name: _.uniqueId('routerAction') });
	} else {
		_.extend(context, { route, name, callback });
	}

	let isRouterHoldsActions = get(router, opts, 'isRouterHoldsActions', true);


	// last chance to get callback from router instance by name
	// this behavior can be disabled through `isRouterHoldsActions` options
	if(!_.isFunction(context.callback) && isRouterHoldsActions && _.isFunction(router[context.name])) {

		context.callback = router[context.name];

	}

	//store original route
	context.rawRoute = context.route;

	!context.name && (context.name = _.uniqueId('routerAction'));

	//converts route to RegExp pattern
	if (!_.isRegExp(context.route)) context.route = router._routeToRegExp(context.route);

	// by default backbone router wraps every callback with own wrapper
	// which in turn call actual callback with correct arguments on route
	// this callback was inlined and can not be overrided, so now its possible	
	context.callbackWrapper = _.bind(router._processCallback, router, context);

	return context;
}



