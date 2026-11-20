import { loadTray } from '#lib/server/tray.js';
import { logCsv, fileSafe } from '#lib/server/export.js';

export function GET({ params, locals }) {
	const { tray, cl, state } = loadTray(params.id);
	return new Response(logCsv(tray, state, cl, `${locals.person?.name ?? ''} <${locals.email}>`), {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${cl.id}-${fileSafe(tray.designation)}-log.csv"`
		}
	});
}
