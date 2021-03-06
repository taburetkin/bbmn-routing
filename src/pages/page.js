import _ from 'underscore';
import { MnObject } from 'bbmn-core';
import { mix, getOption, buildViewByKey } from 'bbmn-utils';
import { startableMixin }  from 'bbmn-components';

import { childrenableMixin } from 'bbmn-mixins';
import RoutesMixin from './routes-mixin.js';




const BasePage = mix(MnObject).with(childrenableMixin, startableMixin, RoutesMixin);

export default BasePage.extend({
	constructor(opts = {}){
		BasePage.apply(this, arguments);

		//root and parent is childrenable options
		this.mergeOptions(opts, ['app','router','canNotStart','onStart','onBeginStart', 'onBeforeStart', 'onEndStart', 'onStop', 'onBeginStop', 'onBeforeStop', 'onEndStop']);

		// resides in routes-mixin
		this.initializeRoutes();

		// resides in ChildrenableMixin
		this.initializeChildren();
		
		// resides in routes-mixin
		this.registerAllRoutes();

		this.initializeEvents();
	},
	getOption(...args){
		return getOption(this, ...args);
	},
	getLabel(data){
		let result = this.getOption('label', { args: [this, data]});
		return result;
	},
	getTitle(data){
		let result = this.getOption('title', { args: [this, data]});
		return result || this.getLabel(data);
	},
	getMenuLabel(data){
		let result = this.getOption('menuLabel', { args: [this, data], default: this.getLabel(data)});
		return result;
	},

	buildChildOptions(options){
		let root = this.getRoot();
		let defs = {
			root,
			parent: this.parent,
			router: this.router,
			app: this.app,
		};
		let result = _.extend(defs, options);
		return result;
	},

	getSiblings(opts = {}){

		let parent = this.getParent();
		let options = _.extend({ exclude: [this] }, opts);
		return parent && parent.getChildren(options) || [];

	},

	getHashes(data){
		
		data = this._normalizeHashData(data, true);

		let page = this;
		let parentHash = false;
		if (this.isEntityPage) {
			page = page.getParent();
			parentHash = true;
		}
		return this._getPageHashes(page, data, parentHash);
	},
	_getPageHashes(page, data, isParentHash){
		let parent = page.getParent();
		let root = page.getRoot();

		return {
			isParentHash,
			path: page.getPathHash(data),
			this: page.getHash(data),
			root: root && root.getHash && root.getHash(data) || undefined,
			parent: parent && parent.getHash && parent.getHash(data) || undefined,
			children: page.getChildrenHashes(data),
			siblings: page.getSiblingsHashes(data)
		};
	},
	getPathHash(data){
		let self = this.getHash(data);
		let path = [self];
		let parent = this.getParent();
		if (parent && _.isFunction(parent.getPathHash)) {
			path.unshift(...parent.getPathHash(data));
		}
		return path;
	},
	getChildrenHashes(data){
		return this.getChildren({ map: i => i.getHash(data), visible: true, });
	},
	getSiblingsHashes(data){
		return this.getSiblings({ map: i => i.getHash(data), visible: true, });
	},

	getRoot(){
		if (this.root === true) {
			return this;
		} else {
			return this.root;
		}
	},
	getAllPages(opts = {}){
		let data = this._normalizeHashData(opts.data, true);
		let options = _.extend({ data }, opts, { includeSelf: true });
		delete options.map;
		let pages = this.getRoot().getAllChildren(options);

		if (_.isFunction(opts.map)) {
			return _(pages).chain().map(page => opts.map(page, options)).filter(f => !!f).value();
		} else {
			return pages;
		}
	},

	getAllHashes(data, opts = {}){
		data = this._normalizeHashData(data, true);
		let options = _.extend({ map: i => i.getHash(data), visible: true, }, opts);
		return this.getAllPages(options);
	},

	_normalizeHashData(data, root){
		if (root && !data) {
			let ac = this.getLastActionContext();
			data = this.getRouteData(ac);
		}
		return data;
	},
	getHash(data, root = true){
		let context = this.getMainRouteContext();
		if(!_.isObject(context))
			return;

		data = this._normalizeHashData(data, root);

		let parent = this.getParent();
		let parentCid = parent && parent.cid || undefined;		
		return {
			cid: this.cid,
			parentCid,
			menuLabel: this.getMenuLabel(data),
			label: this.getLabel(data),
			order: this.order,
			route: context.route,
			url: context.getUrl(data),
			icon: this.getPageIcon()
		};
	},
	getPageIcon() {
		return this.icon;
	},
	_getLastStartArguments(){
		return (this['startable.start.lastArguments'] || []);
	},
	_lastActionContextIndex: 1,
	getLastActionContext({ original } = {}){
		let startArgs = this._getLastStartArguments();
		let ac = startArgs[this._lastActionContextIndex];
		if (ac && original && ac.original) {
			ac = ac.original;
		}
		return ac;
	},
	getDefaultRouteData(ac = {}){
		return _.extend({}, ac.qs, ac.args);
	},
	getRouteData(ac) {
		let custom = this.getOption('data', { args: [this, ac] });
		return _.extend({}, this.getDefaultRouteData(ac), custom);
	},

	_childFilter(item, index, opts = {}) {
		let base = BasePage.prototype._childFilter;
		if(base && !base.apply(this, arguments))
			return;

		let { visible } = opts;

		if (item.isEntityPage) return;

		if (visible && (item.visible === false || item.hidden === true))
			return;

		return item;
	},

	initializeEvents(){
		if (this._triggerOnParentInitiallized) return;

		let triggersOn = [];
		if(this.app){
			triggersOn.push(this.app);
		}
		if(this.router){
			triggersOn.push(this.router);
		}
		let events = ['start', 'stop'];
		_.each(events, event => {
			this.on(event, (...args) => {
				_.each(triggersOn, parent => {
					parent.triggerMethod('page:' + event, this, ...args);
				});
			});
		});

		this._triggerOnParentInitiallized = true;
	},
	getView(opts){
		let options = _.extend({ model: this.model, collection: this.collection, page: this }, opts);
		return this.buildView(options);
	},
	//good place to override build options, or build itself
	buildView(options){
		return this._buildViewByKey(options);
	},
	_buildViewByKey(options){		
		let view = buildViewByKey(this, 'Layout', { options });
		if(!view) {
			view = buildViewByKey(this, 'layout', { defaultOptions: options });
		}
		return view;
	},

	getStartPromises(){
		
		let promises = this.getOption('startPromises', { args: [ this ]});
		if(!promises) return;

		return _.map(promises, item =>{
			if (_.isFunction(item)) {
				return item.call(this, this);
			} else {
				return item;
			}
		});
	},
	getStopPromises(){
		
		let promises = this.getOption('stopPromises', { args: [ this ]});
		if(!promises) return;

		return _.map(promises, item =>{
			if (_.isFunction(item)) {
				return item.call(this, this);
			} else {
				return item;
			}
		});
	},	

});

