import _ from 'underscore';
import { history, Events, BaseClass }  from 'bbmn-core';
import { mix } from 'bbmn-utils';
import historyApi from './api';

const Watcher = mix(BaseClass).with(Events).extend({
	constructor(){
		BaseClass.apply(this, arguments);
		this.isWatching = false;
		this.entries = [];
	},
	start(){
		if (this.isWatching) return;
		this.isWatching = true;
		this.listenTo(history, 'route', this.onRoute);
		this.listenTo(history, 'backroute', this.onBackRoute);
	},
	stop(){
		this.stopListening(history);
		this.entries.length = 0;
		this.isWatching = false;
	},
	isActionContext: cntx => _.isObject(cntx) && _.isString(cntx.fragment),
	hasElements(){
		return this.entries.length > 0;
	},
	canGoBack(){
		return this.hasElements();
	},
	onRoute(actionContext){

		if(!this.isActionContext(actionContext))
			return;

		if (this.isActionContext(this.lastElement)) {
			this.entries.push(this.lastElement);
		}
		this.lastElement = actionContext;

	},
	onBackRoute(actionContext){
		if(!this.isActionContext(actionContext) || !this.isActionContext(actionContext.gobackContext))
			return;

		let lookFor = actionContext.gobackContext;
		let index = this.entries.indexOf(lookFor);
		if (index >= 0) {
			this.entries = this.entries.slice(0, index);
			this.lastElement = lookFor;
		}

	},
	goBack(){
		if (!this.canGoBack()) return;
		let last = _.last(this.entries);
		historyApi.navigate(last.fragment, { trigger: true, routeType: 'backroute', gobackContext: last });
	},
});

export default new Watcher();
