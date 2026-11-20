import { loadTray } from '#lib/server/tray.js';
import { describe, completionIssues } from '#lib/server/state.js';

export function load({ params }) {
	const { tray, cl, state } = loadTray(params.id);
	const { steps, fields, involved, components, exceptions, photos } = state;
	return {
		tray,
		state: { steps, fields, involved, components, exceptions, photos },
		log: state.log.map((e) => ({ ...e, d: describe(e, cl) })),
		issues: completionIssues(state, cl),
		exportedAt: new Date().toISOString()
	};
}
