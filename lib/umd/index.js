(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('underscore'), require('bbmn-utils'), require('bbmn-core'), require('jquery'), require('bbmn-components')) :
	typeof define === 'function' && define.amd ? define(['exports', 'underscore', 'bbmn-utils', 'bbmn-core', 'jquery', 'bbmn-components'], factory) :
	(factory((global.bbmn = global.bbmn || {}, global.bbmn.routing = {}),global._,global.bbmn.utils,global.bbmn,global.$,global.bbmn.components));
}(this, (function (exports,_,bbmnUtils,bbmnCore,$,bbmnComponents) { 'use strict';

_ = _ && _.hasOwnProperty('default') ? _['default'] : _;
$ = $ && $.hasOwnProperty('default') ? $['default'] : $;

function get(router) {
	var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
	var key = arguments[2];
	var update = arguments[3];


	var value = bbmnUtils.betterResult(opts, key, { context: router, args: [router] });
	if (value == null) {
		value = router.getOption(key, { args: [router] });
		if (update) opts[key] = value;
	}
	return value;
}

// converts route method arguments to plain object;
// _normalizeRegisterRouteArguments
// { route, rawRoute, callback, name }
function routeArgumentsToObject(router, route, name, callback) {
	var opts = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};


	var context = {};

	if (_.isObject(route)) {
		context = route;

		//then second argument is probably options;
		_.extend(opts, name);
	} else if (_.isFunction(name)) {
		_.extend(context, { route: route, callback: name, name: _.uniqueId('routerAction') });
	} else {
		_.extend(context, { route: route, name: name, callback: callback });
	}

	var isRouterHoldsActions = get(router, opts, 'isRouterHoldsActions', true);

	// last chance to get callback from router instance by name
	// this behavior can be disabled through `isRouterHoldsActions` options
	if (!_.isFunction(context.callback) && isRouterHoldsActions && _.isFunction(router[context.name])) {

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

function createActionContext(router, routeContext, fragment) {
	var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};


	var rawArgs = router._extractParameters(routeContext.route, fragment);

	var result = _.extend({}, routeContext, { fragment: fragment, rawArgs: rawArgs }, options, { options: options });

	var args = rawArgs.slice(0);
	var queryString = args.pop();

	_.extend(result, { qs: prepareActionQueryString(router, queryString) });
	_.extend(result, { args: prepareActionArguments(routeContext.rawRoute, args) });

	if (result.routeType == null) {
		result.routeType = 'route';
	}

	return result;
}

function prepareActionQueryString(router, queryString) {
	if (_.isString(queryString)) return router.queryStringParser(queryString);else return {};
}

function prepareActionArguments(rawRoute, args) {

	var params = rawRoute.match(/:([^/|)]+)/g) || [];

	var res = {};
	_(params).each(function (name, index) {
		name = name.substring(1);

		if (args == null) return;

		if (name in res && _.isArray(res[name])) res[name].push(args[index]);else if (name in res && !_.isArray(res[name])) res[name] = [res[name]].concat(args[index]);else res[name] = args[index];
	});
	return res;
}

function toPromise(arg) {
	var resolve = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

	if (arg instanceof Promise || arg && _.isFunction(arg.then)) return arg;else if (arg instanceof Error) return Promise.reject(arg);else return resolve ? Promise.resolve(arg) : Promise.reject(arg);
}

function getCallbackFunction(callback, executeResult) {
	return function () {
		try {
			executeResult.value = callback && callback.apply(undefined, arguments);
		} catch (exception) {
			executeResult.value = exception;
		}
		executeResult.promise = toPromise(executeResult.value);
		return executeResult.value;
	};
}

function processCallback(router, actionContext, routeType) {

	var args = router.getOption('classicMode') ? actionContext.rawArgs || [] : [actionContext];

	var asPromise = router.getOption('callbackAsPromises');
	var executeResult = {};
	var callback = getCallbackFunction(actionContext.callback, executeResult, asPromise);

	router.triggerEvent('before:' + routeType, actionContext);

	var shouldTriggerEvent = router.execute(callback, args);
	if (shouldTriggerEvent !== false) {
		router.triggerEvent(routeType, actionContext);
		if (routeType == 'route' || routeType == 'backroute') router.lastAttempt = actionContext;
	}

	executeResult.promise.then(function (arg) {
		router.triggerEvent('after:' + routeType, actionContext);
		return arg;
	}, function (error) {
		router.triggerEvent('error:' + routeType, error, actionContext);
		router.handleError(error, actionContext);
	});

	return executeResult.value;
}

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var routeErrorHandler = {
	handlers: {
		'js:error': function jsError(error) {
			throw error;
		}
	},
	handle: function handle(error, context, args) {
		var _this = this;

		var handlers = this._getHandleContext(error, context, args) || {};
		return _(handlers).some(function (options, key) {
			return _this.applyHandler(key, options);
		});
	},
	applyHandler: function applyHandler(key) {
		var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};


		var handler = this.getHandler(key, options);
		if (!handler) return;
		var context = options.context,
		    args = options.args;

		return handler.apply(context, args);
	},
	getHandler: function getHandler(key) {
		if (_.isFunction(this.handlers[key])) return this.handlers[key];
	},
	setHandler: function setHandler(key, handler) {
		if (!_.isString(key) || key === '') throw new Error('setHandler first argument must be a non empty string');

		if (!_.isFunction(handler)) {
			delete this.handlers[key];
		} else {
			this.handlers[key] = handler;
		}
	},
	setHandlers: function setHandlers(hash) {
		var _this2 = this;

		var nullable = hash === null;
		var items = nullable && this.handlers || hash;
		if (!_.isObject(items)) return;
		_(items).each(function (handler, key) {
			return _this2.setHandler(key, nullable || handler);
		});
	},


	// should return hash: { 'handler_key': { context: handler_context, args: handler_arguments}}
	_getHandleContext: function _getHandleContext(error, context) {
		var _this3 = this;

		var args = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];


		if (_.isArray(error)) {
			return _(error).reduce(function (memo, item) {
				return _.extend(memo, _this3._getHandleContext(item, context, args));
			}, {});
		}

		if (_.isFunction(this.getHandleContext)) {
			var custom = this.getHandleContext(error, context, args);
			if (custom != null) return custom;
		}

		if (error instanceof Error) {
			args.unshift(error);
			return { 'js:error': { context: context, args: args } };
		} else if (_.isString(error)) {
			return _defineProperty({}, error, { context: context, args: args });
		} else if (error instanceof $.Deferred().constructor) {
			args.unshift(error);
			return { 'jq:xhr': { context: context, args: args } };
		}
	},


	// provide your own arguments processor
	// should return hash: { 'handler_key': { context: handler_context, args: handler_arguments}}
	getHandleContext: undefined

};

//import paramStringToObject from '../../../utils/params-to-object/index.js';
//import { Backbone, Router as BbRouter } from '../../../vendors/backbone.js';

var Router$1 = bbmnCore.Router.extend({

	// for migrating from Mn.AppRoute
	// set to true. it will populate routes from { controller, appRoutes } structure.
	isMarionetteStyle: false,

	// by default Backbone.Router tries to lookup callback in router instance by name `callback = this[name]` if there is no callback provided
	// its recomend to turn this feature to false
	// default value is true for Backbone.Router compatability
	isRouterHoldsActions: true,

	// by default Backbone.Router `route` method returns router itself instead of just created routeContext for chaining purposes.
	// you can change this behavior turning this feature to false
	isRouteChaining: true,

	//in classic mode actions receive argument array
	//if you need actionContext instead turn this option to false
	classicMode: true,

	constructor: function constructor() {
		var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};


		this.options = _.extend({}, _.result(this, 'options'), options);

		bbmnCore.Router.apply(this, arguments);
	},
	getOption: function getOption$$1() {
		return bbmnUtils.getOption.call.apply(bbmnUtils.getOption, [this].concat(Array.prototype.slice.call(arguments)));
	},


	/*
 
 	initialize methods
 	"when a router initialized"
 
 */

	//by default router expects that routes will result in { route, callback } hash
	//we are extending this to provide more flexibility
	// - overrided
	_bindRoutes: function _bindRoutes() {

		var routes = this.getInitRoutes();
		if (!_.size(routes)) return;
		this.addRoutes(routes);
	},
	getInitRoutes: function getInitRoutes() {
		var routes = void 0;
		if (this.getOption('isMarionetteStyle')) {
			var controller = this.getOption('controller') || {};
			var approutes = this.getOption('appRoutes') || {};
			routes = _(approutes).map(function (name, route) {
				return {
					route: route, name: name,
					callback: controller[name]
				};
			});
		} else {
			routes = this.getOption('routes');
		}
		return routes;
	},


	/*
 	manipulating routes
 	adding
 */

	// refactored original route method
	// chain:true by default is for supporting default behavior
	// routerHoldsActions: true - backbone router tries to get callback from router itself if there is no callback provided. 
	// this options allow to support this behavior, but its recomended not to hold action inside router instance
	// - overrided
	route: function route(_route, name, callback) {
		var opts = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};


		//normalizing passed arguments and putting them into a context object
		//refactored from original route
		// let context = this._normalizeRegisterRouteArguments(route, name, callback, opts);

		// //extends context with result of `mergeWithRegisterRouteContext`
		// this._normalizeRegisterRouteContext(context);

		// //wrapping provided callback 
		// this._normalizeRegisterRouteCallback(context);

		var context = this._buildRouteContext(_route, name, callback, opts);

		//refactored for providing possibility to override
		//at this point context should be almost ready
		this.registerRouteContext(context);

		this._storeCreatedContext(context, opts);

		return opts.isRouteChaining === true ? this : context;
	},


	// provide more semantic alias for route
	addRoute: function addRoute(route, name, callback) {
		var opts = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

		if (opts.isRouteChaining == null) opts.isRouteChaining = this.getOption('isRouteChaining');

		var context = this.route(route, name, callback, opts);
		return context;
	},


	//process many routes at once
	//accepts object { name, routeContext | handler }
	// or array of routeContexts
	addRoutes: function addRoutes(routes) {
		var _this = this;

		var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};


		if (opts.isRouteChaining == null) opts.isRouteChaining = this.getOption('isRouteChaining');

		var normalized = _(routes).chain().map(function (value, key) {
			return _this._normalizeRoutes(value, key);
		}).filter(function (f) {
			return _.isObject(f);
		}).value();

		if (opts.doNotReverse != true) normalized.reverse();

		var registered = _(normalized).map(function (route) {
			return route && _this.addRoute(route, _.extend({ massAdd: true }, opts));
		});

		if (opts.doNotReverse != true) registered.reverse();

		_(registered).each(function (c) {
			return _this._storeCreatedContext(c);
		});

		return registered;
	},


	// internal method called by `addRoutes` to normalize provided data
	_normalizeRoutes: function _normalizeRoutes(value, key) {
		//let route, name, callback;
		var context = void 0;
		if (_.isString(value)) {
			context = {
				route: key,
				name: value
			};
		} else if (_.isFunction(value)) {
			context = { route: key, callback: value };
		} else if (_.isObject(value)) {
			context = _.clone(value);
			if (!_.has(context, 'route')) context.route = key;else if (_.has(context, 'route') && !_.has(context, 'name')) context.name = key;
		} else {
			return;
		}
		return context;
	},
	_buildRouteContext: function _buildRouteContext(route, name, callback, opts) {

		var context = routeArgumentsToObject(this, route, name, callback, opts);

		return this.buildRouteContext(context);
	},


	//override this method if you need more information in route context
	// should return object wich will be merged with default context
	// be aware of providing reserved properties: route, name, callback
	// this will override context defaults
	buildRouteContext: function buildRouteContext(context) {
		return context;
	},

	//finally, putting handler to the backbone.history.handlers
	registerRouteContext: function registerRouteContext(context) {
		Backbone.history.route(context.route, context.callbackWrapper, context);
	},


	//store registered context for further use
	_storeCreatedContext: function _storeCreatedContext(context) {
		var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

		this.routeContexts || (this.routeContexts = {});
		if (!opts.massAdd) this.routeContexts[context.name] = context;
		return context;
	},


	/*
 
 	process route methods		
 	"when route happens"
 
 */

	//inner route handler
	//preparing actionContext and calls public processCallback
	_processCallback: function _processCallback(routeContext, fragment) {
		var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

		var actionContext = createActionContext(this, routeContext, fragment, options);
		actionContext.restart = function () {
			return actionContext.callbackWrapper(fragment, options);
		};
		var result = this.processCallback(actionContext, actionContext.routeType, options);
		return result;
	},


	//by default behave as original router
	//override this method to process action by your own
	processCallback: function processCallback$$1(actionContext, routeType) {

		return processCallback(this, actionContext, routeType);
	},
	handleError: function handleError(error, action) {
		routeErrorHandler.handle(error, this, [action]);
	},


	//just triggers appropriate events
	// triggerRouteEvents(context, event, name, ...args) {
	// 	if (event == 'route') {
	// 		this.lastActionContext = context;
	// 	}
	// 	this.trigger(`${event}:${name}`, ...args);
	// 	this.trigger(event, name, ...args);
	// 	Backbone.history.trigger(event, this, name, ...args);
	// },

	triggerEvent: function triggerEvent(event, context) {
		this.trigger(event, context);
		Backbone.history.trigger(event, context);
	},


	//converts string to object
	//default implementation, can be overriden by user
	queryStringParser: bbmnUtils.paramsToObject,

	// navigate(...args){
	// 	historyNavigate(...args);
	// 	return this;
	// },

	_routeToRegExp: function _routeToRegExp(route) {

		var optionalParam = /\((.*?)\)/g;
		var namedParam = /(\(\?)?:\w+/g;
		var splatParam = /\*\w+/g;
		var escapeRegExp = /[-{}[]+?.,\\\^$|#\s]/g;

		route = route.replace(escapeRegExp, '\\$&').replace(optionalParam, '(?:$1)?').replace(namedParam, function (match, optional) {
			return optional ? match : '([^/?]+)';
		}).replace(splatParam, '([^?]*?)');
		var flags = this.getOption('routeCaseInsensitive') ? 'i' : '';
		return new RegExp('^' + route + '(?:\\?([\\s\\S]*))?$', flags);
	},


	/*
 	Some API methods
 */

	getContextByFragment: function getContextByFragment(fragment) {
		if (!_.isString(fragment)) return;
		//let contexts = this.routeContexts;
		//console.log('Router contexts', contexts);
		var result = _(this.routeContexts).find(function (cntx) {
			return cntx.route.test(fragment);
		});
		return result;
	}
});

var PagedApp = bbmnComponents.App.extend({});

var index = {
	Router: Router$1,
	routeErrorHandler: routeErrorHandler,
	PagedApp: PagedApp
};

exports.Router = Router$1;
exports.routeErrorHandler = routeErrorHandler;
exports.PagedApp = PagedApp;
exports['default'] = index;

Object.defineProperty(exports, '__esModule', { value: true });

})));

//# sourceMappingURL=index.js.map
