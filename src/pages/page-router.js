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
		return this.beforePageStart(page)
			.then(() => page.start(...args))
			.then(() => this.afterPageStart(page, ...args));
	},

	beforePageStart(){
		if (this.previousPage && this.previousPage.isStarted())
			return this.previousPage.stop();
		else
			return Promise.resolve();
	},

	afterPageStart(page){
		this.previousPage = page;
	},

	restartLastAttempt(){
		if(this.lastAttempt)
			return this.lastAttempt.restart();
	}
});
