import _ from 'underscore';
import { App } from 'bbmn-components';
import { historyApi } from '../history/index.js';
import PageRouter from './page-router.js';
import Page from './page';
import { buildByKey } from 'bbmn-utils';
import { isClass } from 'bbmn-core';

export default App.extend({
	constructor(){
		
		this._pages = [];

		App.apply(this, arguments);
		this.on('start', this._buildPages);
		this.on('pages:ready', this._startHistory);
		this.on('page:start', this._onPageStart);
		this.on('page:stop', this._onPageStop);
	},
	Router: PageRouter,
	_startHistory(){
		if (historyApi.isStarted()) return;

		let options = this.getOption('startHistory');
		if(!options) { return; }
		if (options === true) {
			options = { pushState: false };
		} else if (!_.isObject(options)) {
			return;
		}


		this.triggerMethod('before:history:start', result);

		var result = historyApi.start(options);

		this.triggerMethod('history:start', result);
	},
	_buildPages(){
		this.triggerMethod('before:pages:ready');
		this.buildPages();
		this.triggerMethod('pages:ready');
	},
	buildPages() {
		
		if (this.rootPage instanceof Page) return;

		this.triggerMethod('before:router:create');
		this.router = this.buildRouter();
		this.triggerMethod('router:create', this.router);

		var RootPage = this.getOption('RootPage');
		if (isClass(RootPage, Page)) {
			this.rootPage = new RootPage({ router: this.router, shouldRegisterAllRoutes: true, app: this });
		}

	},	
	buildRouter(){
		if (this.router instanceof PageRouter) return this.router;
		return buildByKey(this, 'Router', { ctor: PageRouter });
	},
	_onPageStart(page){
		this.showPage(page);
	},
	showPage: _.noop,
	_onPageStop(page){
		this.showPage(page);
	},
	hidePage: _.noop,
});
