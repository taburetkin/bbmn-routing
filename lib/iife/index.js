this.bbmn = this.bbmn || {};
this.bbmn.routing = (function (exports,_,bbmnUtils,bbmnCore,$,bbmnComponents,bbmnMixins) {
'use strict';

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
		bbmnCore.history.actionContext = actionContext;
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

//import $ from 'jquery';

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
	setHandler: function setHandler(key, handler, bindTo) {
		if (!_.isString(key) || key === '') throw new Error('setHandler first argument must be a non empty string');

		if (!_.isFunction(handler)) {
			delete this.handlers[key];
		} else {
			if (bindTo) {
				handler = handler.bind(bindTo);
			}
			this.handlers[key] = handler;
		}
	},
	setHandlers: function setHandlers(hash, bindTo) {
		var _this2 = this;

		var nullable = hash === null;
		var items = nullable && this.handlers || hash;
		if (!_.isObject(items)) return;
		_(items).each(function (handler, key) {
			return _this2.setHandler(key, nullable || handler, bindTo);
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
		return bbmnUtils.getOption.apply(undefined, [this].concat(Array.prototype.slice.call(arguments)));
	},

	triggerMethod: bbmnUtils.triggerMethod,
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
		bbmnCore.history.route(context.route, context.callbackWrapper, context);
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
		bbmnCore.history.trigger(event, context);
	},


	//converts string to object
	//default implementation, can be overriden by user
	queryStringParserOptions: { complex: true },
	queryStringParser: function queryStringParser(string, opts) {
		var options = _.extend({}, this.getOption('queryStringParserOptions'), opts);
		return bbmnUtils.paramsToObject(string, options);
	},


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

var pathStripper = /#.*$/;

var historyApi = {
	decodeFragment: function decodeFragment(fragment) {
		fragment = bbmnCore.history.getFragment(fragment || '');
		fragment = fragment.replace(pathStripper, '');
		return bbmnCore.history.decodeFragment(fragment);
	},

	// supports passing options to the callback
	// by using new version of loadUrl	
	navigate: function navigate(fragment, opts) {

		var options = opts === true ? { trigger: true } : _.isObject(opts) ? _.clone(opts) : {};

		var trigger = options.trigger;

		options.trigger = false;

		var decodedFragment = this.decodeFragment(fragment);
		if (bbmnCore.history.fragment == decodedFragment) {
			return;
		}

		bbmnCore.history.navigate(fragment, options);

		if (trigger) {
			return historyApi.loadUrl(fragment, opts);
		}
	},
	execute: function execute(fragment, opts) {
		//fragment = history.fragment = history.getFragment(fragment);
		fragment = bbmnCore.history.getFragment(fragment);

		var executed = historyApi.executeHandler(fragment, opts);
		if (!executed) {
			routeErrorHandler.handle('not:found', opts.context, [fragment]);
		}
		return executed;
	},


	// original loadUrl does not pass options to the callback
	// and this one does
	loadUrl: function loadUrl(fragment) {
		var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};


		// If the root doesn't match, no routes can match either.
		if (!bbmnCore.history.matchRoot()) return false;
		return historyApi.execute(fragment, opts);

		// fragment = history.fragment = history.getFragment(fragment);

		// let executed = historyApi.executeHandler(fragment, opts);
		// if (!executed) {
		// 	errorHandler.handle('not:found', opts.context, [fragment]);
		// }
		// return executed;
	},


	// default test handler
	//TODO: think about constraints check
	testHandler: function testHandler(handler, fragment) {
		return handler.route.test(fragment);
	},


	//also accepts test function, if you wish test handlers by your own
	findHandler: function findHandler(fragment, customTest) {
		var test = _.isFunction(customTest) ? customTest : historyApi.testHandler;
		fragment = bbmnCore.history.getFragment(fragment);
		return _.filter(bbmnCore.history.handlers || [], function (handler) {
			return test(handler, fragment);
		})[0];
	},
	executeHandler: function executeHandler(fragment) {
		var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
		var resultContext = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};


		var handler = historyApi.findHandler(fragment, opts.testHandler);

		handler && (resultContext.value = handler.callback(fragment, opts));

		return !!handler;
	},

	// this start replaces native history loadUrl and test handler
	start: function start(options) {

		if (bbmnCore.history.loadUrl !== historyApi.loadUrl) bbmnCore.history.loadUrl = historyApi.loadUrl;

		var result = bbmnCore.history.start(options);

		return result;
	},
	isStarted: function isStarted() {
		return !!bbmnCore.history.started;
	},
	getUrlPath: function getUrlPath() {
		return bbmnCore.history.fragment.split('?')[0];
	},
	changeUrlQueryString: function changeUrlQueryString(qs) {
		var url = this.getUrlPath();
		if (qs) {
			url = [url, qs].join('?');
		}
		return this.navigate(url, { trigger: false });
	}
};

var Watcher = bbmnUtils.mix(bbmnCore.BaseClass).with(bbmnCore.Events).extend({
	constructor: function constructor() {
		bbmnCore.BaseClass.apply(this, arguments);
		this.isWatching = false;
		this.entries = [];
	},
	start: function start() {
		if (this.isWatching) return;
		this.isWatching = true;
		this.listenTo(bbmnCore.history, 'route', this.onRoute);
		this.listenTo(bbmnCore.history, 'backroute', this.onBackRoute);
	},
	stop: function stop() {
		this.stopListening(bbmnCore.history);
		this.clear();
		this.isWatching = false;
	},
	clear: function clear() {
		this.entries.length = 0;
		delete this.lastElement;
	},

	isActionContext: function isActionContext(cntx) {
		return _.isObject(cntx) && _.isString(cntx.fragment);
	},
	hasElements: function hasElements() {
		return this.entries.length > 0;
	},
	canGoBack: function canGoBack() {
		return this.hasElements();
	},
	onRoute: function onRoute(actionContext) {

		if (!this.isActionContext(actionContext)) return;

		if (this.isActionContext(this.lastElement)) {
			this.entries.push(this.lastElement);
		}
		this.lastElement = actionContext;
	},
	onBackRoute: function onBackRoute(actionContext) {
		if (!this.isActionContext(actionContext) || !this.isActionContext(actionContext.gobackContext)) return;

		var lookFor = actionContext.gobackContext;
		var index = this.entries.indexOf(lookFor);
		if (index >= 0) {
			this.entries = this.entries.slice(0, index);
			this.lastElement = lookFor;
		}
	},
	goBack: function goBack() {
		if (!this.canGoBack()) return;
		var last = _.last(this.entries);
		historyApi.navigate(last.fragment, { trigger: true, routeType: 'backroute', gobackContext: last });
	}
});

var historyWatcher = new Watcher();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var PageRouter = Router$1.extend({

	classicMode: false,
	isRouterHoldsActions: false,
	isRouteChaining: false,
	callbackAsPromises: true,
	routeCaseInsensitive: true,

	setTitleOnPageStart: true,

	registerPageRoutes: function registerPageRoutes(page) {
		var _this = this;

		var contexts = page.getRoutesContexts({ reverse: true });
		_.each(contexts, function (context) {
			var callback = function callback() {
				for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
					args[_key] = arguments[_key];
				}

				return _this.startPage.apply(_this, [page].concat(args));
			};
			_this.addRoute(context.route, context.name, callback);
		});
	},
	handleError: function handleError(process, action) {
		var args = void 0,
		    error = void 0;

		if (process instanceof bbmnComponents.Process) {
			args = [].slice.call(process.errors);
			error = args.shift();
			args.push(action);
		} else {
			error = process;
			args = [action];
		}

		routeErrorHandler.handle(error, this, args);
	},
	startPage: function startPage(page) {
		var _this2 = this;

		for (var _len2 = arguments.length, args = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
			args[_key2 - 1] = arguments[_key2];
		}

		return this._beforePageStart(page).then(function () {
			return page.start.apply(page, _toConsumableArray(args));
		}).then(function () {
			return _this2._afterPageStart.apply(_this2, [page].concat(_toConsumableArray(args)));
		});
	},
	_beforePageStart: function _beforePageStart() {
		this.beforePageStart();
		if (this.previousPage && this.previousPage.isStarted()) return this.previousPage.stop();else return Promise.resolve();
	},
	beforePageStart: function beforePageStart() {},
	_afterPageStart: function _afterPageStart(page) {
		this.previousPage = page;
		this.afterPageStart(page);
		this._setPageTitle(page);
	},
	afterPageStart: function afterPageStart() {},
	_setPageTitle: function _setPageTitle(page) {
		if (!this.getOption('setTitleOnPageStart')) {
			return;
		}
		var title = page.getTitle();
		this.setPageTitle(title, page);
	},


	//implement your set title logic here
	//accepts: title, page
	setPageTitle: function setPageTitle(title) {
		document.title = title;
	},
	restartLastAttempt: function restartLastAttempt() {
		if (this.lastAttempt) return this.lastAttempt.restart();
	}
});

var RoutesMixin = {
	initializeRoutes: function initializeRoutes() {
		if (this.initializeRouter()) {
			this._buildRoutesContexts();
		}
	},
	initializeRouter: function initializeRouter() {
		if (this.getOption('shouldCreateRouter') && !this.router) {
			this.router = this._createRouter();
			this._shouldRegisterAllRoutes = true;
		}

		if (this.getOption('shouldRegisterAllRoutes')) {
			this._shouldRegisterAllRoutes = true;
		}

		return !!this.router;
	},
	_createRouter: function _createRouter() {
		var Router$$1 = this.getOption('Router') || PageRouter;
		var options = _.extend({}, this.getOption('routerOptions'));
		return new Router$$1(options);
	},
	registerAllRoutes: function registerAllRoutes() {
		if (!this._shouldRegisterAllRoutes) return;

		var pages = this.getAllChildren({ reverse: true, includeSelf: true, force: true });

		var router = this.router;
		_(pages).each(function (page) {
			return router.registerPageRoutes(page);
		});
	},
	_buildRoutesContexts: function _buildRoutesContexts() {
		var _this = this;

		var routes = this.getOption('routes', { args: [this] });
		if (routes == null) return;
		if (_.isString(routes)) routes = [routes];

		var result = [];
		var config = this.getRoutesConfig();
		_(routes).each(function (route, index) {
			var context = _this._normalizeRoutesContextRoute(route, index, config);
			_.isObject(context) && result.push(context);
		});
		this.routesContext = result;
		return this.routesContext;
	},
	_normalizeRoutesContextRoute: function _normalizeRoutesContextRoute(arg, index) {
		var config = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

		if (arguments.length < 2) {
			config = this.getRoutesConfig();
		}
		var context = { page: this };
		if (arg == null) return;
		if (_.isString(arg)) {
			_.extend(context, { route: arg, rawRoute: arg });
		} else if (_.isFunction(arg)) {
			arg = arg.call(this, this, index);
			return this._normalizeRoutesContextRoute(arg, index);
		} else {
			_.extend(context, arg);
		}
		var name = _.isString(index) && index || context.name || context.route || _.uniqueId('route');
		context.name = name;

		if (_.isNumber(index) && context.order == null) context.order = index;

		if (!context.rawRoute) context.rawRoute = context.route;

		if (config.relative && config.parentContext && config.parentContext.route) context.route = config.parentContext.route + '/' + context.route;

		context.getUrl = function () {
			var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

			return this.route.replace(/:([^/?]+)/, function (found, group) {
				return data[group];
			});
		};

		return context;
	},
	getRoutesConfig: function getRoutesConfig() {
		var config = _.extend({
			relative: this.getOption('relativeRoutes', { args: [this] }),
			parent: this.parent,
			parentContext: this.parent && _.isFunction(this.parent.getMainRouteContext) && this.parent.getMainRouteContext()
		}, this.getOption('routesConfig', { args: [this] }));

		return config;
	},
	getRoutesContexts: function getRoutesContexts() {
		var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
		var clone = opts.clone,
		    reverse = opts.reverse;

		var result = this.routesContext || [];
		if (clone || reverse) result = [].slice.call(result);
		if (reverse) result.reverse();
		return result;
	},
	getMainRouteContext: function getMainRouteContext() {

		if (this.mainRouteContext) return this.mainRouteContext;
		this.mainRouteContext = _(this.getRoutesContexts()).chain().sortBy(function (a, b) {
			return bbmnUtils.comparator([[b, a, function (c) {
				return c.main;
			}], [a, b, function (c) {
				return c.order;
			}]]);
		}).take(1).value()[0];

		return this.mainRouteContext;
	}
};

function _toConsumableArray$1(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var BasePage = bbmnUtils.mix(bbmnCore.MnObject).with(bbmnMixins.childrenableMixin, bbmnComponents.startableMixin, RoutesMixin);

var Page = BasePage.extend({
	constructor: function constructor() {
		var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		BasePage.apply(this, arguments);

		//root and parent is childrenable options
		this.mergeOptions(opts, ['app', 'router', 'canNotStart', 'onStart', 'onBeginStart', 'onBeforeStart', 'onEndStart', 'onStop', 'onBeginStop', 'onBeforeStop', 'onEndStop']);

		// resides in routes-mixin
		this.initializeRoutes();

		// resides in ChildrenableMixin
		this.initializeChildren();

		// resides in routes-mixin
		this.registerAllRoutes();

		this.initializeEvents();
	},
	getOption: function getOption$$1() {
		for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
			args[_key] = arguments[_key];
		}

		return bbmnUtils.getOption.apply(undefined, [this].concat(_toConsumableArray$1(args)));
	},
	getLabel: function getLabel(data) {
		var result = this.getOption('label', { args: [this, data] });
		return result;
	},
	getTitle: function getTitle(data) {
		var result = this.getOption('title', { args: [this, data] });
		return result || this.getLabel(data);
	},
	getMenuLabel: function getMenuLabel(data) {
		var result = this.getOption('menuLabel', { args: [this, data], default: this.getLabel(data) });
		return result;
	},
	buildChildOptions: function buildChildOptions(options) {
		var root = this.getRoot();
		var defs = {
			root: root,
			parent: this.parent,
			router: this.router,
			app: this.app
		};
		var result = _.extend(defs, options);
		return result;
	},
	getSiblings: function getSiblings() {
		var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};


		var parent = this.getParent();
		var options = _.extend({ exclude: [this] }, opts);
		return parent && parent.getChildren(options) || [];
	},
	getHashes: function getHashes(data) {

		data = this._normalizeHashData(data, true);

		var page = this;
		var parentHash = false;
		if (this.isEntityPage) {
			page = page.getParent();
			parentHash = true;
		}
		return this._getPageHashes(page, data, parentHash);
	},
	_getPageHashes: function _getPageHashes(page, data, isParentHash) {
		var parent = page.getParent();
		var root = page.getRoot();

		return {
			isParentHash: isParentHash,
			path: page.getPathHash(data),
			this: page.getHash(data),
			root: root && root.getHash && root.getHash(data) || undefined,
			parent: parent && parent.getHash && parent.getHash(data) || undefined,
			children: page.getChildrenHashes(data),
			siblings: page.getSiblingsHashes(data)
		};
	},
	getPathHash: function getPathHash(data) {
		var self = this.getHash(data);
		var path = [self];
		var parent = this.getParent();
		if (parent && _.isFunction(parent.getPathHash)) {
			path.unshift.apply(path, _toConsumableArray$1(parent.getPathHash(data)));
		}
		return path;
	},
	getChildrenHashes: function getChildrenHashes(data) {
		return this.getChildren({ map: function map(i) {
				return i.getHash(data);
			}, visible: true });
	},
	getSiblingsHashes: function getSiblingsHashes(data) {
		return this.getSiblings({ map: function map(i) {
				return i.getHash(data);
			}, visible: true });
	},
	getRoot: function getRoot() {
		if (this.root === true) {
			return this;
		} else {
			return this.root;
		}
	},
	getAllPages: function getAllPages() {
		var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		var data = this._normalizeHashData(opts.data, true);
		var options = _.extend({ data: data }, opts, { includeSelf: true });
		delete options.map;
		var pages = this.getRoot().getAllChildren(options);

		if (_.isFunction(opts.map)) {
			return _(pages).chain().map(function (page) {
				return opts.map(page, options);
			}).filter(function (f) {
				return !!f;
			}).value();
		} else {
			return pages;
		}
	},
	getAllHashes: function getAllHashes(data) {
		var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

		data = this._normalizeHashData(data, true);
		var options = _.extend({ map: function map(i) {
				return i.getHash(data);
			}, visible: true }, opts);
		return this.getAllPages(options);
	},
	_normalizeHashData: function _normalizeHashData(data, root) {
		if (root && !data) {
			var ac = this.getLastActionContext();
			data = this.getRouteData(ac);
		}
		return data;
	},
	getHash: function getHash(data) {
		var root = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

		var context = this.getMainRouteContext();
		if (!_.isObject(context)) return;

		data = this._normalizeHashData(data, root);

		var parent = this.getParent();
		var parentCid = parent && parent.cid || undefined;
		return {
			cid: this.cid,
			parentCid: parentCid,
			label: this.getMenuLabel(data),
			order: this.order,
			route: context.route,
			url: data ? context.getUrl(data) : context.route,
			icon: this.getPageIcon()
		};
	},
	getPageIcon: function getPageIcon() {
		return this.icon;
	},
	_getLastStartArguments: function _getLastStartArguments() {
		return this['startable.start.lastArguments'] || [];
	},

	_lastActionContextIndex: 1,
	getLastActionContext: function getLastActionContext() {
		var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
		    original = _ref.original;

		var startArgs = this._getLastStartArguments();
		var ac = startArgs[this._lastActionContextIndex];
		if (ac && original && ac.original) {
			ac = ac.original;
		}
		return ac;
	},
	getDefaultRouteData: function getDefaultRouteData() {
		var ac = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		return _.extend({}, ac.qs, ac.args);
	},
	getRouteData: function getRouteData(ac) {
		var custom = this.getOption('data', { args: [this, ac] });
		return _.extend({}, this.getDefaultRouteData(ac), custom);
	},
	_childFilter: function _childFilter(item, index) {
		var opts = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

		var base = BasePage.prototype._childFilter;
		if (base && !base.apply(this, arguments)) return;

		var visible = opts.visible;


		if (item.isEntityPage) return;

		if (visible && (item.visible === false || item.hidden === true)) return;

		return item;
	},
	initializeEvents: function initializeEvents() {
		var _this = this;

		if (this._triggerOnParentInitiallized) return;

		var triggersOn = [];
		if (this.app) {
			triggersOn.push(this.app);
		}
		if (this.router) {
			triggersOn.push(this.router);
		}
		var events = ['start', 'stop'];
		_.each(events, function (event) {
			_this.on(event, function () {
				for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
					args[_key2] = arguments[_key2];
				}

				_.each(triggersOn, function (parent) {
					parent.triggerMethod.apply(parent, ['page:' + event, _this].concat(args));
				});
			});
		});

		this._triggerOnParentInitiallized = true;
	},
	getView: function getView(opts) {
		var options = _.extend({ model: this.model, collection: this.collection, page: this }, opts);
		return this.buildView(options);
	},

	//good place to override build options, or build itself
	buildView: function buildView(options) {
		return this._buildViewByKey(options);
	},
	_buildViewByKey: function _buildViewByKey(options) {
		var view = bbmnUtils.buildViewByKey(this, 'Layout', { options: options });
		if (!view) {
			view = bbmnUtils.buildViewByKey(this, 'layout', { defaultOptions: options });
		}
		return view;
	},
	getStartPromises: function getStartPromises() {
		var _this2 = this;

		var promises = this.getOption('startPromises', { args: [this] });
		if (!promises) return;

		return _.map(promises, function (item) {
			if (_.isFunction(item)) {
				return item.call(_this2, _this2);
			} else {
				return item;
			}
		});
	},
	getStopPromises: function getStopPromises() {
		var _this3 = this;

		var promises = this.getOption('stopPromises', { args: [this] });
		if (!promises) return;

		return _.map(promises, function (item) {
			if (_.isFunction(item)) {
				return item.call(_this3, _this3);
			} else {
				return item;
			}
		});
	}
});

var PagedApp = bbmnComponents.App.extend({
	historyWatcher: false,
	Router: PageRouter,

	constructor: function constructor() {

		this._pages = [];
		bbmnComponents.App.apply(this, arguments);
		this._initRouteErrors();
		this._initPageListeners();
	},
	_initRouteErrors: function _initRouteErrors() {
		var handlers = this.getOption('routeErrors', { args: [this] });
		if (!_.isObject(handlers)) return;
		routeErrorHandler.setHandlers(handlers, this);
	},
	_initPageListeners: function _initPageListeners() {
		this.once({
			'start': this._buildPages,
			'pages:ready': this.render,
			'layout:ready': this._startHistory
		});
		this.on({
			'page:start': this._onPageStart,
			'page:stop': this._onPageStop
		});

		// this.on('start', this._buildPages);
		// this.on('pages:ready', this._startHistory);
		// this.on('page:start', this._onPageStart);
		// this.on('page:stop', this._onPageStop);
	},
	_startHistoryWatcher: function _startHistoryWatcher() {
		if (!this.getOption('historyWatcher')) return;
		historyWatcher.start();
	},
	_startHistory: function _startHistory() {
		if (historyApi.isStarted()) return;

		this._startHistoryWatcher();

		var options = this.getOption('startHistory');
		if (!options) {
			return;
		}
		if (options === true) {
			options = { pushState: false };
		} else if (!_.isObject(options)) {
			return;
		}

		this.triggerMethod('before:history:start', result);

		var result = historyApi.start(options);

		this.triggerMethod('history:start', result);
	},
	_buildPages: function _buildPages() {
		this.triggerMethod('before:pages:ready');
		this.buildPages();
		this.triggerMethod('pages:ready');
	},
	buildPages: function buildPages() {

		if (this.rootPage instanceof Page) return;

		this.triggerMethod('before:router:create');
		this.router = this.buildRouter();
		this.triggerMethod('router:create', this.router);

		var RootPage = this.getOption('RootPage');
		if (bbmnCore.isClass(RootPage, Page)) {
			this.rootPage = new RootPage({ router: this.router, shouldRegisterAllRoutes: true, app: this });
		}
	},
	buildRouter: function buildRouter() {
		if (this.router instanceof PageRouter) return this.router;
		return bbmnUtils.buildByKey(this, 'Router', { ctor: PageRouter });
	},
	_onPageStart: function _onPageStart() {
		this.showPage.apply(this, arguments);
	},

	showPage: _.noop,
	_onPageStop: function _onPageStop() {
		this.hidePage.apply(this, arguments);
	},

	hidePage: _.noop
});

var index = {
	Router: Router$1,
	routeErrorHandler: routeErrorHandler,
	PagedApp: PagedApp, PageRouter: PageRouter, Page: Page,
	history: bbmnCore.history, historyApi: historyApi, historyWatcher: historyWatcher
};

exports.Router = Router$1;
exports.routeErrorHandler = routeErrorHandler;
exports.PagedApp = PagedApp;
exports.PageRouter = PageRouter;
exports.Page = Page;
exports.history = bbmnCore.history;
exports.historyApi = historyApi;
exports.historyWatcher = historyWatcher;
exports['default'] = index;

return exports;

}({},_,bbmn.utils,bbmn,$,bbmn.components,bbmn.mixins));

//# sourceMappingURL=index.js.map
