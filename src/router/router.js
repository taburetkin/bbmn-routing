import _ from 'underscore';
import {  getOption, triggerMethod, paramsToObject as paramStringToObject } from 'bbmn-utils';
import { Router as BbRouter, history } from 'bbmn-core';

//import paramStringToObject from '../../../utils/params-to-object/index.js';
//import { Backbone, Router as BbRouter } from '../../../vendors/backbone.js';

import buildRouteContextFromArguments from './build-route-context.js';

import  { createActionContext } from './action-context.js';
import { processCallback } from './process-callback.js';
import errorHandler from '../route-error-handler/index.js';



const Router = BbRouter.extend({


	// for migrating from Mn.AppRoute
	// set to true. it will populate routes from { controller, appRoutes } structure.
	isMarionetteStyle: false,

	// by default Backbone.Router tries to lookup callback in router instance by name `callback = this[name]` if there is no callback provided
	// its recomend to turn this feature to false
	// default value is true for Backbone.Router compatability
	isRouterHoldsActions : true,

	// by default Backbone.Router `route` method returns router itself instead of just created routeContext for chaining purposes.
	// you can change this behavior turning this feature to false
	isRouteChaining: true,

	//in classic mode actions receive argument array
	//if you need actionContext instead turn this option to false
	classicMode: true,

	constructor(options = {}){
		
		this.options = _.extend({}, _.result(this, 'options'), options);

		BbRouter.apply(this, arguments);


	},

	getOption(){
		return getOption.call(this, ...arguments);
	},
	triggerMethod,
	/*

		initialize methods
		"when a router initialized"

	*/

	//by default router expects that routes will result in { route, callback } hash
	//we are extending this to provide more flexibility
	// - overrided
	_bindRoutes: function() {
		
		let routes = this.getInitRoutes();
		if(!_.size(routes)) return;
		this.addRoutes(routes);

	},
	getInitRoutes(){
		let routes;
		if(this.getOption('isMarionetteStyle')) {
			let controller = this.getOption('controller') || {};
			let approutes = this.getOption('appRoutes') || {};
			routes = _(approutes).map((name, route) => ({ 
				route, name, 
				callback: controller[name] 
			}));
		}
		else {
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
	route(route, name, callback, opts = {}){
		
		//normalizing passed arguments and putting them into a context object
		//refactored from original route
		// let context = this._normalizeRegisterRouteArguments(route, name, callback, opts);

		// //extends context with result of `mergeWithRegisterRouteContext`
		// this._normalizeRegisterRouteContext(context);

		// //wrapping provided callback 
		// this._normalizeRegisterRouteCallback(context);

		let context = this._buildRouteContext(route, name, callback, opts);

		//refactored for providing possibility to override
		//at this point context should be almost ready
		this.registerRouteContext(context);

		this._storeCreatedContext(context, opts);

		return opts.isRouteChaining === true 
			? this 
			: context;

	},

	// provide more semantic alias for route
	addRoute(route, name, callback, opts = {}){
		if(opts.isRouteChaining == null)
			opts.isRouteChaining = this.getOption('isRouteChaining');

		let context = this.route(route, name, callback, opts);
		return context;
	},

	//process many routes at once
	//accepts object { name, routeContext | handler }
	// or array of routeContexts
	addRoutes(routes, opts = {}){

		if(opts.isRouteChaining == null)
			opts.isRouteChaining = this.getOption('isRouteChaining');

		let normalized = _(routes)
			.chain()
			.map((value, key) => this._normalizeRoutes(value, key))
			.filter(f => _.isObject(f))
			.value();

		if(opts.doNotReverse != true)
			normalized.reverse();

		let registered = _(normalized).map(
			route => route && 
			this.addRoute(route, _.extend({ massAdd:true }, opts))
		); 
		
		if(opts.doNotReverse != true)
			registered.reverse();

		_(registered).each((c) => this._storeCreatedContext(c));
		
		return registered;
	},

	// internal method called by `addRoutes` to normalize provided data
	_normalizeRoutes(value, key){
		//let route, name, callback;
		let context;
		if (_.isString(value)) {
			context = { 
				route: key, 
				name: value, 
			};
		}
		else if(_.isFunction(value)){
			context = { route:key, callback:value };
		}else if(_.isObject(value)){
			context = _.clone(value);
			if(!_.has(context, 'route'))
				context.route = key;
			else if(_.has(context, 'route') && !_.has(context, 'name'))
				context.name = key;
		}
		else {
			return;
		}
		return context;
	},




	_buildRouteContext(route, name, callback, opts) {

		let context = buildRouteContextFromArguments(this, route, name, callback, opts);

		return this.buildRouteContext(context);
	},

	//override this method if you need more information in route context
	// should return object wich will be merged with default context
	// be aware of providing reserved properties: route, name, callback
	// this will override context defaults
	buildRouteContext: context => context,


	//finally, putting handler to the backbone.history.handlers
	registerRouteContext(context){
		history.route(context.route, context.callbackWrapper, context);
	},

	//store registered context for further use
	_storeCreatedContext(context, opts = {}){
		this.routeContexts || (this.routeContexts = {});
		if(!opts.massAdd)
			this.routeContexts[context.name] = context;
		return context;
	},



	/*
	
		process route methods		
		"when route happens"

	*/

	//inner route handler
	//preparing actionContext and calls public processCallback
	_processCallback (routeContext, fragment, options = {}) {
		let actionContext = createActionContext(this, routeContext, fragment, options);
		actionContext.restart = () => actionContext.callbackWrapper(fragment, options);
		let result = this.processCallback(actionContext, actionContext.routeType, options);
		return result;
	},
	
	//by default behave as original router
	//override this method to process action by your own
	processCallback(actionContext, routeType){

		return processCallback(this, actionContext, routeType);

	},

	handleError(error, action){		
		errorHandler.handle(error, this, [action]);
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

	triggerEvent(event, context){
		this.trigger(event, context);
		history.trigger(event, context);
	},




	//converts string to object
	//default implementation, can be overriden by user
	queryStringParser: paramStringToObject,	

	// navigate(...args){
	// 	historyNavigate(...args);
	// 	return this;
	// },

	_routeToRegExp(route) {

		var optionalParam = /\((.*?)\)/g;
		var namedParam    = /(\(\?)?:\w+/g;
		var splatParam    = /\*\w+/g;
		var escapeRegExp  = /[-{}[]+?.,\\\^$|#\s]/g;

		route = route.replace(escapeRegExp, '\\$&')
			.replace(optionalParam, '(?:$1)?')
			.replace(namedParam, function(match, optional) {
				return optional ? match : '([^/?]+)';
			})
			.replace(splatParam, '([^?]*?)');
		let flags = this.getOption('routeCaseInsensitive') ? 'i' : '';
		return new RegExp('^' + route + '(?:\\?([\\s\\S]*))?$', flags);
	},


	/*
		Some API methods
	*/

	getContextByFragment(fragment)	{
		if(!_.isString(fragment)) return;
		//let contexts = this.routeContexts;
		//console.log('Router contexts', contexts);
		let result = _(this.routeContexts).find((cntx) => cntx.route.test(fragment));
		return result;
	}


});

export default Router;
