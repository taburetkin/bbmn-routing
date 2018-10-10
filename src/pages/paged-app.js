import _ from 'underscore';
import { App } from 'bbmn-components';

export default App.extend({
	constructor(){
		App.apply(this, arguments);

	},
	_startHistory(){
		let historyOptions = this.getOption('startHistory');
		if(!historyOptions) { return; }
		if (historyOptions === true) {
			historyOptions = { pushState: false };
		} else if (!_.isObject(historyOptions)) {
			return;
		}

		

	}
});
