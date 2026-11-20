import { loadTray } from '#lib/server/tray.js';
import { recordTex, fileSafe } from '#lib/server/export.js';

export function GET({ params }) {
	const { tray, cl, state } = loadTray(params.id);
	return new Response(recordTex(tray, state, cl), {
		headers: {
			'Content-Type': 'application/x-tex; charset=utf-8',
			'Content-Disposition': `attachment; filename="${cl.id}-${fileSafe(tray.designation)}-record.tex"`
		}
	});
}
