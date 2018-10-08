export function createActionContext(router, routeContext, fragment, options = {}) {

	let rawArgs = router._extractParameters(routeContext.route, fragment);

	let result = _.extend({}, routeContext, { fragment, rawArgs }, options, { options });

	let args = rawArgs.slice(0);
	let queryString = args.pop();

	_.extend(result, { qs: prepareActionQueryString(router, queryString) });
	_.extend(result, { args: prepareActionArguments(routeContext.rawRoute, args) });

	if (result.routeType == null) {
		result.routeType = 'route';
	}

	return result;
}

function prepareActionQueryString(router, queryString){
	if(_.isString(queryString))
		return router.queryStringParser(queryString);
	else
		return {};
}

function prepareActionArguments(rawRoute, args){

	let params = rawRoute.match(/:([^/|)]+)/g) || [];
	
	let res = {};
	_(params).each((name, index) => {
		name = name.substring(1);
		
		if(args == null) return;

		if(name in res && _.isArray(res[name]))
			res[name].push(args[index]);
		else if(name in res && !_.isArray(res[name]))
			res[name] = [res[name]].concat(args[index]);
		else
			res[name] = args[index];
	});
	return res;
}
