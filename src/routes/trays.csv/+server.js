import { listTrays, trayEvents } from '#lib/server/db.js';
import { deriveState, passedCount } from '#lib/server/state.js';
import { summaryCsv } from '#lib/server/export.js';

export function GET() {
	const trays = listTrays().map((tray) => {
		const state = deriveState(trayEvents(tray.id));
		return { tray, state, passed: passedCount(state) };
	});
	return new Response(summaryCsv(trays), {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': 'attachment; filename="btl-trays-summary.csv"'
		}
	});
}
