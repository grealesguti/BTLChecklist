import { fail, redirect } from '@sveltejs/kit';
import { CHECKLISTS, DEFAULT_CHECKLIST, isChecklist } from '#lib/checklists/index.js';
import { listTrays, trayEvents, allDesignations, addPerson, addTray } from '#lib/server/db.js';
import { deriveState, passedCount, statusText } from '#lib/server/state.js';
import { priorProblems, describePrior } from '#lib/server/tray.js';
import { Invalid, personName, designation, safeBack, rateLimit, text } from '#lib/server/validate.js';

// Selected checklist: ?c=<id>, remembered in a cookie so "/" returns to the last one used.
export function load({ url, cookies }) {
	let c = url.searchParams.get('c');
	if (isChecklist(c)) cookies.set('checklist', c, { path: '/', httpOnly: true, sameSite: 'strict', maxAge: 365 * 86400 });
	else c = isChecklist(cookies.get('checklist')) ? cookies.get('checklist') : DEFAULT_CHECKLIST;
	const cl = CHECKLISTS[c];
	// ponytail: replays every record's log per request; cache if records reach the thousands.
	const trays = listTrays(c).map((tray) => {
		const state = deriveState(trayEvents(tray.id));
		const prior = priorProblems(tray.designation, cl);
		return { ...tray, status: statusText(state), passed: passedCount(state, cl), last: state.log.at(-1)?.at ?? tray.created_at, prior: prior.length ? describePrior(prior) : '' };
	});
	return { trays, checklist: c, total: cl.STEPS.length, designations: allDesignations() };
}

export const actions = {
	/** A logged-in user adds someone by name only: listed, but cannot log in or sign until they set a password. */
	addPersonNoLogin: async ({ request, locals }) => {
		if (!rateLimit('register:' + locals.email, 10, 3600_000)) return fail(429, { error: 'Too many new names this hour.' });
		const data = await request.formData();
		try {
			const person = addPerson(personName(data.get('name')), text(data.get('role'), 40, { label: 'Role', required: true }), locals.email);
			if (!person) throw new Invalid('This name is already registered.');
		} catch (e) {
			if (e instanceof Invalid) return fail(400, { error: e.message });
			throw e;
		}
		redirect(303, safeBack(data.get('back')));
	},

	createTray: async ({ request, locals }) => {
		if (!rateLimit('tray:' + locals.email, 20, 3600_000)) return fail(429, { error: 'Too many new trays this hour.' });
		const data = await request.formData();
		const c = data.get('checklist');
		if (!isChecklist(c)) return fail(400, { error: 'Unknown checklist.' });
		const cl = CHECKLISTS[c];
		let id;
		try {
			const d = designation(data.get('designation'));
			// Earlier processes of this tray missing or not approved: warn, and only start after an explicit
			// confirmation (also catches a mistyped tray number, which has no earlier records).
			const prior = priorProblems(d, cl);
			if (prior.length && data.get('confirmPrior') !== 'yes')
				return fail(400, { error: `Tray ${d}: earlier processes not approved — ${describePrior(prior)}. Check the tray number; to start anyway, tick the confirmation box.`, needConfirm: d });
			id = addTray(d, c, locals.person.id, locals.email, cl.REVISION);
		} catch (e) {
			if (e instanceof Invalid) return fail(400, { error: e.message });
			throw e;
		}
		if (!id) return fail(400, { error: `A ${cl.title} record with this designation already exists.` });
		redirect(303, `/tray/${id}`);
	}
};
