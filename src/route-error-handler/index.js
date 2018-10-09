import _ from 'underscore';
import $ from 'jquery';
//import $ from 'jquery';

export default {
	handlers: {
		'js:error'(error){
			throw error;
		},
	},
	handle(error, context, args){

		let handlers = this._getHandleContext(error, context, args) || {};
		return _(handlers).some((options, key) => this.applyHandler(key, options));

	},
	applyHandler(key, options = {}){

		let handler = this.getHandler(key, options);
		if (!handler) return;
		let { context, args } = options;
		return handler.apply(context, args);

	},
	getHandler(key){
		if(_.isFunction(this.handlers[key]))
			return this.handlers[key];
	},
	setHandler(key, handler){
		if(!_.isString(key) || key === '')
			throw new Error('setHandler first argument must be a non empty string');

		if (!_.isFunction(handler)) {
			delete this.handlers[key];
		} else {
			this.handlers[key] = handler;
		}
	},
	setHandlers(hash){
		let nullable = hash === null;
		let items = nullable && this.handlers || hash;
		if(!_.isObject(items)) return;
		_(items).each((handler, key) => this.setHandler(key, nullable || handler));
	},

	// should return hash: { 'handler_key': { context: handler_context, args: handler_arguments}}
	_getHandleContext(error, context, args = []){

		if (_.isArray(error)) {
			return _(error).reduce((memo, item) => _.extend(memo, this._getHandleContext(item, context, args)), {});
		}

		if(_.isFunction(this.getHandleContext)) {
			let custom = this.getHandleContext(error, context, args);
			if(custom != null) return custom;
		}

		if (error instanceof Error) {
			args.unshift(error);
			return { 'js:error': { context, args } };
		}
		else if(_.isString(error)) {
			return { [error]: { context, args } };
		}
		else if(error instanceof $.Deferred().constructor){
			args.unshift(error);
			return { 'jq:xhr': { context, args }};
		}

	},

	// provide your own arguments processor
	// should return hash: { 'handler_key': { context: handler_context, args: handler_arguments}}
	getHandleContext: undefined,

};
