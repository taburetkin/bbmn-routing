import _ from 'underscore';
import { Process } from 'bbmn-components';
import BaseRouter from '../router/router.js';
import errorHandler from '../route-error-handler/index.js';

export default BaseRouter.extend({
	
	classicMode:false,
	isRouterHoldsActions : false,
	isRouteChaining: false,	
	callbackAsPromises: true,
	routeCaseInsensitive: true,

	setTitleOnPageStart : true,

	registerPageRoutes(page){
		let contexts = page.getRoutesContexts({ reverse: true });
		_.each(contexts, context => {
			let callback = (...args) => {
				return this.startPage(page, ...args);
			};
			this.addRoute(context.route, context.name, callback);
		});
	},

	handleError(process, action){
		let args, error;

		if(process instanceof Process) {
			args = [].slice.call(process.errors) ;
			error = args.shift();
			args.push(action);
		} else {
			error = process;
			args = [action];
		}

		errorHandler.handle(error, this, args);

	},
	startPage(page, ...args){
		return this._beforePageStart(page)
			.then(() => page.start(...args))
			.then(() => this._afterPageStart(page, ...args));
	},

	_beforePageStart(){
		this.beforePageStart();
		if (this.previousPage && this.previousPage.isStarted())
			return this.previousPage.stop();
		else
			return Promise.resolve();
	},
	beforePageStart(){},

	_afterPageStart(page){
		this.previousPage = page;
		this.afterPageStart();
		this._setPageTitle();
	},
	afterPageStart(){},
	_setPageTitle(page){
		if(!this.getOption('setTitleOnPageStart')) {
			return;
		}
		let title = page.getTitle();
		this.setPageTitle(title, page);
	},
	
	//implement your set title logic here
	//accepts: title, page
	setPageTitle(){},
	restartLastAttempt(){
		if(this.lastAttempt)
			return this.lastAttempt.restart();
	}
});
