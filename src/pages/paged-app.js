import _ from 'underscore';
import { App } from 'bbmn-components';
import { historyApi, historyWatcher } from '../history/index.js';
import PageRouter from './page-router.js';
import Page from './page';
import { buildByKey } from 'bbmn-utils';
import { isClass } from 'bbmn-core';

export default App.extend({
	historyWatcher: false,
	Router: PageRouter,

	constructor(){
		
		this._pages = [];
		App.apply(this, arguments);
		this._initPageListeners();
	},
	_initPageListeners(){
		this.on('start', this._buildPages);
		this.on('pages:ready', this._startHistory);
		this.on('page:start', this._onPageStart);
		this.on('page:stop', this._onPageStop);
	},
	_startHistoryWatcher(){
		if(this.getOption('historyWatcher')) return;
		historyWatcher.start();
	},
	_startHistory(){
		if (historyApi.isStarted()) return;

		this._startHistoryWatcher();

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
	_onPageStart(...args){
		this.showPage(...args);
	},
	showPage: _.noop,
	_onPageStop(...args){
		this.showPage(...args);
	},
	hidePage: _.noop,
});
