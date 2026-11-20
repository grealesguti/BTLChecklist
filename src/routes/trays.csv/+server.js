import { CHECKLISTS, DEFAULT_CHECKLIST, isChecklist } from '#lib/checklists/index.js';
import { listTrays, trayEvents } from '#lib/server/db.js';
import { deriveState, passedCount } from '#lib/server/state.js';
import { summaryCsv } from '#lib/server/export.js';

export function GET({ url }) {
	const c = isChecklist(url.searchParams.get('c')) ? url.searchParams.get('c') : DEFAULT_CHECKLIST;
	const cl = CHECKLISTS[c];
	const trays = listTrays(c).map((tray) => {
		const state = deriveState(trayEvents(tray.id));
		return { tray, state, passed: passedCount(state, cl) };
	});
	return new Response(summaryCsv(trays, cl), {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="btl-${c}-summary.csv"`
		}
	});
}
