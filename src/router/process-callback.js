
function toPromise(arg, resolve = true){
	if (arg instanceof Promise || (arg && _.isFunction(arg.then)))
		return arg;
	else if (arg instanceof Error)
		return Promise.reject(arg);
	else
		return resolve 
			? Promise.resolve(arg) 
			: Promise.reject(arg);
}


function getCallbackFunction(callback, executeResult)
{
	return (...args) => {
		try {
			executeResult.value = callback && callback(...args);
		} catch(exception) {
			executeResult.value = exception;
		}
		executeResult.promise = toPromise(executeResult.value);
		return executeResult.value;
	};
}


export function processCallback(router, actionContext, routeType){	
	
	let args = router.getOption('classicMode') 
		? actionContext.rawArgs || [] 
		: [ actionContext ];

	let asPromise = router.getOption('callbackAsPromises');
	let executeResult = {};
	let callback = getCallbackFunction(actionContext.callback, executeResult, asPromise);


	
	router.triggerEvent('before:' + routeType, actionContext);

	let shouldTriggerEvent = router.execute(callback, args);
	if (shouldTriggerEvent !== false) {
		router.triggerEvent(routeType, actionContext);
		if(routeType == 'route' || routeType == 'backroute')
			router.lastAttempt = actionContext;
	}

	executeResult.promise.then(
		(arg) => {
			router.triggerEvent('after:'+routeType, actionContext);
			return arg;
		},
		(error) => {
			router.triggerEvent('error:' + routeType, error, actionContext);
			router.handleError(error, actionContext);
		}
	);

	return executeResult.value;
}



