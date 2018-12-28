import _ from 'underscore';
import { history } from 'bbmn-core';
import errorHandler from '../route-error-handler/index.js';

const pathStripper = /#.*$/;

const historyApi = {
	decodeFragment(fragment){
		fragment = history.getFragment(fragment || '');
		fragment = fragment.replace(pathStripper, '');
		return history.decodeFragment(fragment);
	},
	// supports passing options to the callback
	// by using new version of loadUrl	
	navigate(fragment, opts){
	
		let options = opts === true ? { trigger: true }
			: _.isObject(opts) ? _.clone(opts)
				: {};
	
		let { trigger } = options;			
		options.trigger = false;

		let decodedFragment = this.decodeFragment(fragment);
		if (history.fragment == decodedFragment) {
			return;
		}

		history.navigate(fragment, options);
	
		if (trigger) {
			return historyApi.loadUrl(fragment, opts);
		}
	
	},

	execute(fragment, opts){
		fragment = history.fragment = history.getFragment(fragment);

		let executed = historyApi.executeHandler(fragment, opts);
		if (!executed) {
			errorHandler.handle('not:found', opts.context, [fragment]);
		}
		return executed;
	},

	// original loadUrl does not pass options to the callback
	// and this one does
	loadUrl(fragment, opts = {}) {

		// If the root doesn't match, no routes can match either.
		if (!history.matchRoot()) return false;
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
	testHandler(handler, fragment){
		return handler.route.test(fragment);
	},

	//also accepts test function, if you wish test handlers by your own
	findHandler(fragment, customTest){
		let test = _.isFunction(customTest) ? customTest : historyApi.testHandler;
		fragment = history.getFragment(fragment);
		return _.filter(history.handlers || [], handler => test(handler, fragment))[0];
	},

	executeHandler(fragment, opts = {}, resultContext = {}) {
		
		let handler = historyApi.findHandler(fragment, opts.testHandler);
		
		handler && (resultContext.value = handler.callback(fragment, opts));

		return !!handler;
	},
	// this start replaces native history loadUrl and test handler
	start(options){

		if(history.loadUrl !== historyApi.loadUrl)
			history.loadUrl = historyApi.loadUrl;
	
		let result = history.start(options);

		return result;
	},
	isStarted(){
		return !!history.started;
	},
	getUrlPath(){
		return history.fragment.split('?')[0];
	},
	changeUrlQueryString(qs){
		let url = this.getUrlPath();
		if(qs){
			url = [url, qs].join('?');
		}
		return this.navigate(url, { trigger: false });
	}
};

export default historyApi;
