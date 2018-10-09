import { createFilter } from 'rollup-pluginutils';
import _ from 'underscore';


const DEFAULT_HEADER = `
import _ from \'underscore\';
`;

const importString = (variable, library) => `import ${variable} from '${library}';\n`;
const testPattern = (name) => new RegExp(`(^|\\W|\\n)${name}(\\W|\\.|$)`,'gm');

function tryAddImport(id, code, globalVar, library){
	const pattern = testPattern(globalVar);
	const result = pattern.test(code);

	if (result) {		
		return importString(globalVar, library) + code;
	} else {
		return code;
	}
}


export default (opts = {}) => {

	let { include = 'src/**/*.js', exclude = 'node_modules/**', modules = {} } = opts;

	let filter = createFilter(include, exclude)
	return {
		name: 'add-import',

		transform (code, id) {
			if (!filter(id)) return;

			let transformedCode = _.reduce(modules, (newCode, library, globalVar) => {
				newCode = tryAddImport(id, newCode, globalVar, library);
				return newCode;
			}, code);

			return {
				code: transformedCode,
				map: null,
			}
		}
	}
}
