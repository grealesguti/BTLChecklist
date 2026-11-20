import { loadTray } from '#lib/server/tray.js';
import { describe } from '#lib/server/state.js';

export function load({ params }) {
	const { tray, cl, state } = loadTray(params.id);
	return { tray, log: state.log.map((e) => ({ ...e, d: describe(e, cl) })).reverse() };
}
