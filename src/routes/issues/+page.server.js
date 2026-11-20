import { fail } from '@sveltejs/kit';
import { CHECKLISTS, isChecklist } from '#lib/checklists/index.js';
import { listIssues, addIssue, addIssueUpdate, getIssue, allDesignations } from '#lib/server/db.js';
import { Invalid, designation, text, rateLimit } from '#lib/server/validate.js';
import { savePhotos } from '#lib/server/photos.js';

// Problems found later on processes already performed, logged by anyone (not while doing the
// checklist: that is the step's Fail / exception). Append-only: an issue and every update are kept.
const STATUSES = ['Open', 'Action decided', 'Fixed', 'Not fixable'];

export function load({ url }) {
	const tray = url.searchParams.get('tray');
	return {
		issues: listIssues(tray ? designation(tray) : null).map((i) => ({ ...i, title: CHECKLISTS[i.checklist]?.title ?? i.checklist })),
		tray,
		designations: allDesignations(),
		statuses: STATUSES
	};
}

const guarded = (fn) => async (event) => {
	if (!rateLimit('issue:' + event.locals.email, 60, 600_000)) return fail(429, { error: 'Too many entries, wait a few minutes.' });
	try {
		await fn(await event.request.formData(), event.locals);
		return { ok: true };
	} catch (e) {
		if (e instanceof Invalid) return fail(400, { error: e.message });
		throw e;
	}
};

export const actions = {
	add: guarded(async (data, locals) => {
		const d = designation(data.get('designation'));
		const c = data.get('checklist');
		if (!isChecklist(c)) throw new Invalid('Choose the process.');
		const type = data.get('type');
		if (!CHECKLISTS[c].knownIssues.some((k) => k.type === type)) throw new Invalid('Choose the kind of problem.');
		const description = text(data.get('description'), 1000, { label: 'Description', required: true, multiline: true });
		const photos = await savePhotos(data, `issue_${c}_${d}`);
		addIssue({ designation: d, checklist: c, type, description, photos }, locals.person.id, locals.email);
	}),
	update: guarded(async (data, locals) => {
		const issue = getIssue(Number(data.get('issue')));
		if (!issue) throw new Invalid('Unknown issue.');
		const status = data.get('status');
		if (!STATUSES.includes(status)) throw new Invalid('Choose a status.');
		const action = text(data.get('action'), 1000, { label: 'Action / result', required: true, multiline: true });
		const photos = await savePhotos(data, `issue${issue.id}_${issue.designation}`);
		addIssueUpdate(issue.id, { status, action, photos }, locals.person.id, locals.email);
	})
};
