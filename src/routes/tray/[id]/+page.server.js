import { fail } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { stepNeeds, readyAt } from '#lib/checklists/common.js';
import { addEvent, getPerson, listIssues } from '#lib/server/db.js';
import { loadTray, previousRecord, priorProblems } from '#lib/server/tray.js';
import { completionIssues, completionWarnings, passedCount } from '#lib/server/state.js';
import { Invalid, text, fieldValue, rateLimit, expired } from '#lib/server/validate.js';
import { checkPhoto, storePhoto, MAX_PHOTOS } from '#lib/server/photos.js';

export function load({ params }) {
	const { tray, cl, state } = loadTray(params.id);
	const { steps, fields, involved, components, exceptions, photos } = state;
	return {
		tray,
		state: { steps, fields, involved, components, exceptions, photos },
		issues: completionIssues(state, cl),
		warnings: completionWarnings(state, cl),
		previous: previousRecord(tray, cl),
		prior: priorProblems(tray.designation, cl),
		openIssues: listIssues(tray.designation).filter((i) => i.status !== 'Fixed').map((i) => ({ id: i.id, type: i.type, status: i.status, checklist: i.checklist })),
		passed: passedCount(state, cl),
		total: cl.STEPS.length
	};
}

/**
 * Wraps an action: checks identity and rate limit, validates input, and appends
 * the returned entries. An entry for an item that already has a value is a
 * revision and needs a reason. Nothing is ever overwritten or removed.
 */
const act = (build) => async ({ request, params, locals }) => {
	if (!locals.person) return fail(400, { error: 'Log in first (top of the page).' });
	if (!rateLimit('write:' + locals.email, 120, 60_000)) return fail(429, { error: 'Too many changes, wait a minute.' });
	const data = await request.formData();
	const { tray, cl, state } = loadTray(params.id);
	try {
		const reason = text(data.get('reason'), 300, { label: 'Reason for revision' });
		const entries = [await build(data, state, locals.person, { tray, cl, email: locals.email })].flat();
		for (const entry of entries) {
			const prev = state.items.get(entry.kind + ':' + entry.key);
			if (!prev) continue;
			if (JSON.stringify(prev.payload, (k, v) => (k === 'reason' ? undefined : v)) === JSON.stringify(entry.payload))
				throw new Invalid('Nothing changed.');
			if (!reason) throw new Invalid('A reason is required to revise a recorded entry.');
			entry.payload.reason = reason;
		}
		for (const entry of entries) addEvent(tray.id, locals.person.id, locals.email, entry);
	} catch (e) {
		if (e instanceof Invalid) return fail(400, { error: e.message });
		throw e;
	}
	return { ok: true };
};

const oneOf = (v, list, label) => {
	if (typeof v !== 'string' || !list.includes(v)) throw new Invalid(`${label}: invalid`);
	return v;
};

const utc = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

export const actions = {
	step: act((data, state, me, { tray, cl }) => {
		const n = oneOf(data.get('step'), Object.keys(cl.STEP_BY_N), 'Step');
		const st = cl.STEP_BY_N[n];
		const result = oneOf(data.get('result'), ['P', 'F'], 'Result');
		const comment = text(data.get('comment'), 500, { label: 'Comment' });
		if (result === 'P') {
			const missing = stepNeeds(st).filter((k) => !state.fields[k]);
			if (missing.length) throw new Invalid(`Step ${n}: record first — ${missing.map((k) => cl.FIELDS[k].label).join(', ')}`);
			if (cl.strictOrder) {
				const open = cl.STEPS.slice(0, cl.STEPS.indexOf(st)).find((x) => state.steps[x.n]?.payload.result !== 'P');
				if (open) throw new Invalid(`Step ${n}: pass step ${open.n} first (steps must be done in order).`);
			}
			const alarm = (st.blockOnAlarm && cl.alarm?.(state.fields)) || st.alarm?.(state.fields);
			if (alarm) throw new Invalid(`Step ${n}: ${alarm}`);
			for (const k of stepNeeds(st))
				if (cl.FIELDS[k].notPast && expired(state.fields[k].payload.value)) throw new Invalid(`Step ${n}: ${cl.FIELDS[k].label} has passed — expired, do not use.`);
			if (st.previous) {
				const prev = previousRecord(tray, cl);
				if (prev.status !== 'Complete') throw new Invalid(`Step ${n}: the ${prev.title} record of ${tray.designation} is not Complete.`);
			}
			if (st.wait) {
				const at = readyAt(st, state.steps);
				if (at == null) throw new Invalid(`Step ${n}: pass step ${st.wait.after} first (curing starts there).`);
				if (Date.now() < at) throw new Invalid(`Step ${n}: curing (${st.wait.hours} h minimum) until ${utc(at)}.`);
			}
			if (st.check2) {
				// Second person: named by whoever submits (one laptop is often shared), never the submitter.
				const id = Number(data.get('checker'));
				const checker = Number.isInteger(id) ? getPerson(id) : null;
				if (!checker) throw new Invalid(`Step ${n}: select the second person who checked it.`);
				if (checker.id === me.id) throw new Invalid(`Step ${n}: the second check must be done by someone else.`);
				return { kind: 'step', key: n, payload: { result, comment, checkedBy: checker.id, checkedByName: checker.name } };
			}
			return { kind: 'step', key: n, payload: { result, comment } };
		}
		if (!comment) throw new Invalid(`Step ${n}: describe the problem when marking Fail.`);
		// A failure also opens an exception entry.
		return [
			{ kind: 'step', key: n, payload: { result, comment } },
			{ kind: 'exception', key: 'ex-' + randomUUID(), payload: { step: n, issue: comment, action: '' } }
		];
	}),

	// Photos of a step (during the work or of the result). Append-only like everything else:
	// a wrong photo stays in the record; upload a better one with a caption saying so.
	photo: act(async (data, state, me, { cl, tray, email }) => {
		const n = oneOf(data.get('step'), Object.keys(cl.STEP_BY_N), 'Step');
		const files = data.getAll('photo').filter((f) => f instanceof File && f.size > 0);
		if (!files.length) throw new Invalid('Choose a photo.');
		if (files.length > MAX_PHOTOS) throw new Invalid(`At most ${MAX_PHOTOS} photos per upload.`);
		if (!rateLimit('photo:' + email, 60, 600_000)) throw new Invalid('Too many photos, wait a few minutes.');
		const caption = text(data.get('caption'), 200, { label: 'Caption' });
		const checked = [];
		// All valid before any is stored. Stored as <checklist>_<tray>_step<NN>_<UTC time>_<hash>.<ext>.
		for (const f of files) checked.push({ ...(await checkPhoto(f, `${cl.id}_${tray.designation}_step${n}`)), name: text(f.name, 100, { label: 'File name' }) });
		return checked.map((p) => {
			storePhoto(p);
			return { kind: 'photo', key: 'ph-' + randomUUID(), payload: { step: n, file: p.file, name: p.name, size: p.size, sha256: p.sha256, caption } };
		});
	}),

	field: act((data, state, me, { cl }) => {
		const key = oneOf(data.get('key'), Object.keys(cl.FIELDS), 'Field');
		const value = fieldValue(cl.FIELDS[key], data.get('value'), getPerson);
		const other = { workLead: 'reviewer', reviewer: 'workLead' }[key];
		if (other && state.fields[other]?.payload.value === value.value) throw new Invalid('Work lead and reviewer must be different people.');
		if (key === 'status' && value.value === 'Complete') {
			if (state.fields.reviewer && state.fields.reviewer.payload.value !== me.id)
				throw new Invalid(`Only the reviewer (${state.fields.reviewer.payload.name}) can set the status to Complete.`);
			const issues = completionIssues(state, cl);
			if (issues.length) throw new Invalid('Cannot complete: ' + issues.join('; '));
		}
		return { kind: 'field', key, payload: value };
	}),

	involve: act((data, state, me) => {
		const id = Number(data.get('person'));
		const person = Number.isInteger(id) ? getPerson(id) : null;
		if (!person) throw new Invalid('Select a registered name.');
		const active = data.get('active') !== 'no';
		// Removing someone needs the record's reviewer.
		if (!active && state.fields.reviewer?.payload.value !== me.id)
			throw new Invalid('Only the assigned reviewer can mark someone as not involved.');
		// Role comes from registration only.
		return { kind: 'involved', key: String(person.id), payload: { name: person.name, role: person.role, active } };
	}),

	component: act((data, state, me, { cl }) => {
		const key = oneOf(data.get('key'), Object.keys(cl.COMPONENTS), 'Component');
		const remarks = text(data.get('remarks'), 200, { label: 'Remarks' });
		return { kind: 'component', key, payload: { accounted: data.get('accounted') === 'yes', remarks } };
	}),

	exception: act((data, state, me, { cl }) => {
		const raw = data.get('key');
		const key = raw ? oneOf(raw, state.exceptions.map((x) => x.key), 'Exception') : 'ex-' + randomUUID();
		const step = data.get('step') ? oneOf(data.get('step'), Object.keys(cl.STEP_BY_N), 'Step') : '';
		const issue = text(data.get('issue'), 500, { label: 'Issue', required: true });
		const action = text(data.get('action'), 500, { label: 'Action / recheck result' });
		return { kind: 'exception', key, payload: { step, issue, action } };
	})
};
