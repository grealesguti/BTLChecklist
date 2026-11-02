import { loadTray } from '#lib/server/tray.js';
import { recordTex, fileSafe } from '#lib/server/export.js';

export function GET({ params }) {
	const { tray, state } = loadTray(params.id);
	return new Response(recordTex(tray, state), {
		headers: {
			'Content-Type': 'application/x-tex; charset=utf-8',
			'Content-Disposition': `attachment; filename="tray-${fileSafe(tray.designation)}-record.tex"`
		}
	});
}
