import { error } from '@sveltejs/kit';
import { getTray, trayEvents } from '#lib/server/db.js';
import { deriveState } from '#lib/server/state.js';

export function loadTray(param) {
	const tray = /^\d{1,9}$/.test(param) ? getTray(Number(param)) : undefined;
	if (!tray) error(404, 'Tray not found');
	return { tray, state: deriveState(trayEvents(tray.id)) };
}
