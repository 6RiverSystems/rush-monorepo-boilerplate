import { FileInfo } from 'json-schema-ref-parser';
import JsonSchemaRefParser from 'json-schema-ref-parser';

import { JSONSchema4 } from './JSONSchema4';
import { applyDateFormat } from './applyDateFormat';

// NOTE: this is the yaml parser copied from v6.1.0 of json-schema-ref-parser (and modified) since it is not exported
//       and this appears to be the only way to hook into parsing refs in order to fixup date fields
export const YamlParser = {
	/**
	 * The order that this parser will run, in relation to other parsers.
	 *
	 * @type {number}
	 */
	order: 200,

	/**
	 * Whether to allow "empty" files. This includes zero-byte files, as well as empty JSON objects.
	 *
	 * @type {boolean}
	 */
	allowEmpty: true,

	/**
	 * Determines whether this parser can parse a given file reference.
	 * Parsers that match will be tried, in order, until one successfully parses the file.
	 * Parsers that don't match will be skipped, UNLESS none of the parsers match, in which case
	 * every parser will be tried.
	 *
	 * @type {RegExp|string[]|function}
	 */
	canParse: ['.yaml', '.yml', '.json'], // JSON is valid YAML

	/**
	 * Parses the given file as YAML
	 *
	 * @param {object} file           - An object containing information about the referenced file
	 * @param {string} file.url       - The full URL of the referenced file
	 * @param {string} file.extension - The lowercased file extension (e.g. ".txt", ".html", etc.)
	 * @param {*}      file.data      - The file contents. This will be whatever data type was returned by the resolver
	 * @returns {Promise}
	 */
	async parse(file: FileInfo): Promise<unknown> {
		let data = file.data;
		if (Buffer.isBuffer(data)) {
			data = data.toString();
		}

		let parsed: JSONSchema4 | undefined;
		if (typeof data === 'string') {
			// YAML property isn't in the types
			parsed = (JsonSchemaRefParser as any).YAML.parse(data);
		} else {
			// data is already a JavaScript value (object, array, number, null, NaN, etc.)
			parsed = data;
		}

		if (parsed) {
			return applyDateFormat(parsed);
		}

		return parsed;
	},
};
