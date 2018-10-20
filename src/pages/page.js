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
	getLabel(){
		let result = this.getOption('label', { args: [this, this.model]});
		return result;
	},
	getMenuLabel(){
		let result = this.getOption('menuLabel', { args: [this, this.model], default: this.getLabel()});
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

	getHashes(){
		let parent = this.getParent();
		let root = this.getRoot();

		return {
			path: this.getPathHash(),
			this: this.getHash(),
			root: root && root.getHash && root.getHash() || undefined,
			parent: parent && parent.getHash && parent.getHash() || undefined,
			children: this.getChildrenHashes(),
			siblings: this.getSiblingsHashes()
		};
	},
	getPathHash(){
		let self = this.getHash();
		let path = [self];
		let parent = this.getParent();
		if (parent && _.isFunction(parent.getPathHash)) {
			path.unshift(...parent.getPathHash());
		}
		return path;
	},
	getChildrenHashes(){
		return this.getChildren({ map: i => i.getHash(), visible: true, });
	},
	getSiblingsHashes(){
		return this.getSiblings({ map: i => i.getHash(), visible: true, });
	},

	getRoot(){
		if (this.root === true) {
			return this;
		} else {
			return this.root;
		}
	},
	getAllPages(opts = {}){
		
		let options = _.extend({}, opts, { includeSelf: true });
		delete options.map;
		let pages = this.getRoot().getAllChildren(options);

		if (_.isFunction(opts.map)) {
			return _(pages).chain().map(opts.map).filter(f => !!f).value();
		} else {
			return pages;
		}
	},

	getAllHashes(opts = {}){
		let options = _.extend({ map: i => i.getHash(), visible: true, }, opts);
		return this.getAllPages(options);
	},

	getHash(){
		let context = this.getMainRouteContext();

		if(!_.isObject(context))
			return;

		let parent = this.getParent();
		let parentCid = parent && parent.cid || undefined;		
		return {
			cid: this.cid,
			parentCid,
			url: context.route,
			label: this.getMenuLabel(),
			order: this.order,
		};
	},


	_childFilter(item, index, opts = {}) {
		let base = BasePage.prototype._childFilter;
		if(base && !base.apply(this, arguments))
			return;

		let { visible } = opts;

		if(visible && (item.visible === false || item.hidden === true))
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
		return this.builView(options);
	},
	//good place to override build options, or build itself
	builView(options){
		return this._buildViewByKey(options);
	},
	_buildViewByKey(options){		
		return buildViewByKey(this, 'Layout', { options });
	},
});

