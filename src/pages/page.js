import _ from 'underscore';
import { MnObject } from 'bbmn-core';
import { mix, getOption } from 'bbmn-utils';
import { StartableMixin }  from 'bbmn-components';

import { childrenableMixin } from 'bbmn-mixins';
import RoutesMixin from './routes-mixin.js';




const BasePage = mix(MnObject).with(childrenableMixin, StartableMixin, RoutesMixin);

export default BasePage.extend({
	constructor(opts = {}){
		BasePage.apply(this, arguments);

		this.mergeOptions(opts, ['root','parent','router','canNotStart','onStart','onBeginStart', 'onBeforeStart', 'onEndStart', 'onStop', 'onBeginStop', 'onBeforeStop', 'onEndStop']);
		
		// resides in routes-mixin
		this.initializeRoutes();

		// resides in ChildrenableMixin
		this.initializeChildren();
		
		// resides in routes-mixin
		this.registerAllRoutes();
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
		return _.extend({
			root: this.root,
			parent: this.parent,
			router: this.router,
		}, options);
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
		return this.root;
	},
	getAllPages(opts = {}){
		
		let options = _.extend({}, opts, { includeSelf: true });
		delete options.map;
		let pages = this.root.getAllChildren(options);

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

});

