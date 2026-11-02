import { loadTray } from '#lib/server/tray.js';
import { describe, totalMass, completionIssues } from '#lib/server/state.js';

export function load({ params }) {
	const { tray, state } = loadTray(params.id);
	const { steps, fields, involved, components, exceptions } = state;
	return {
		tray,
		state: { steps, fields, involved, components, exceptions },
		log: state.log.map((e) => ({ ...e, d: describe(e) })),
		mass: totalMass(state),
		issues: completionIssues(state),
		exportedAt: new Date().toISOString()
	};
}
