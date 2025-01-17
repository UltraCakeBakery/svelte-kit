import fs from 'node:fs';
import path from 'node:path';
import * as url from 'node:url';
import options from './options.js';

/**
 * Loads the template (app/base.html by default) and validates that it has the
 * required content.
 * @param {string} cwd
 * @param {import('types').ValidatedConfig} config
 */
export function load_template(cwd, { kit }) {
	const { env } = kit;

	const relative = path.relative(cwd, 'app/base.html');

	if (!fs.existsSync('app/base.html')) {
		throw new Error(`${relative} does not exist`);
	}

	const contents = fs.readFileSync('app/base.html', 'utf8');

	const expected_tags = ['%sveltekit.head%', '%sveltekit.body%'];
	expected_tags.forEach((tag) => {
		if (contents.indexOf(tag) === -1) {
			throw new Error(`${relative} is missing ${tag}`);
		}
	});

	for (const match of contents.matchAll(/%sveltekit\.env\.([^%]+)%/g)) {
		if (!match[1].startsWith(env.publicPrefix)) {
			throw new Error(
				`Environment variables in ${relative} must start with ${env.publicPrefix} (saw %sveltekit.env.${match[1]}%)`
			);
		}
	}

	return contents;
}

/**
 * Loads the error page (src/error.html by default) if it exists.
 * Falls back to a generic error page content.
 * @param {import('types').ValidatedConfig} config
 */
export function load_error_page(config) {
	let { errorTemplate } = config.kit.files;

	// Don't do this inside resolving the config, because that would mean
	// adding/removing error.html isn't detected and would require a restart.
	if (!fs.existsSync(config.kit.files.errorTemplate)) {
		errorTemplate = url.fileURLToPath(new URL('./default-error.html', import.meta.url));
	}

	return fs.readFileSync(errorTemplate, 'utf-8');
}

/**
 * Loads and validates svelte.config.js
 * @param {{ cwd?: string }} options
 * @returns {Promise<import('types').ValidatedConfig>}
 */
export async function load_config({ cwd = process.cwd() } = {}) {
	const config_file = path.join(cwd, 'svelte.config.js');

	if (!fs.existsSync(config_file)) {
		return process_config({}, { cwd });
	}

	const config = await import(`${url.pathToFileURL(config_file).href}?ts=${Date.now()}`);

	return process_config(config.default, { cwd });
}

/**
 * @param {import('types').Config} config
 * @returns {import('types').ValidatedConfig}
 */
function process_config(config, { cwd = process.cwd() } = {}) {
	const validated = validate_config(config);

	validated.kit.outDir = path.resolve(cwd, validated.kit.outDir);

	for (const key in validated.kit.files) {
		validated.kit.files[key] = path.resolve(cwd, validated.kit.files[key]);
	}

	return validated;
}

/**
 * @param {import('types').Config} config
 * @returns {import('types').ValidatedConfig}
 */
export function validate_config(config) {
	if (typeof config !== 'object') {
		throw new Error(
			'svelte.config.js must have a configuration object as its default export. See https://kit.svelte.dev/docs/configuration'
		);
	}

	return options(config, 'config');
}
