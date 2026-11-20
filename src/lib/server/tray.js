import { error } from '@sveltejs/kit';
import { CHECKLISTS, isChecklist } from '#lib/checklists/index.js';
import { getTray, trayEvents, findTray } from '#lib/server/db.js';
import { deriveState, statusText } from '#lib/server/state.js';

export function loadTray(param) {
	const tray = /^\d{1,9}$/.test(param) ? getTray(Number(param)) : undefined;
	if (!tray || !isChecklist(tray.checklist)) error(404, 'Record not found');
	return { tray, cl: CHECKLISTS[tray.checklist], state: deriveState(trayEvents(tray.id)) };
}

/** One earlier process of a tray: { checklist, title, recordId (null = no record), status, ok (= Complete) }. */
function recordOf(checklist, designation) {
	const r = findTray(checklist, designation);
	const status = r ? statusText(deriveState(trayEvents(r.id))) : null;
	return { checklist, title: CHECKLISTS[checklist].title, recordId: r?.id ?? null, status, ok: status === 'Complete' };
}

/** Every earlier process of this tray (CHAIN order) that is missing or not Complete. Empty = all approved. */
export const priorProblems = (designation, cl) => cl.prior.map((c) => recordOf(c, designation)).filter((p) => !p.ok);

/** The process right before (steps with `previous: true` need it Complete), or null. */
export const previousRecord = (tray, cl) => (cl.after ? recordOf(cl.after, tray.designation) : null);

export const describePrior = (problems) => problems.map((p) => `${p.title}: ${p.recordId ? p.status : 'no record'}`).join('; ');
