import { fail } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { FIELDS, STEP_BY_N, COMPONENTS, STEPS, stepNeeds, foamAlarm, FOAM_ALARM } from '#lib/checklist.js';
import { addEvent, getPerson } from '#lib/server/db.js';
import { loadTray } from '#lib/server/tray.js';
import { completionIssues, totalMass, passedCount } from '#lib/server/state.js';
import { Invalid, text, fieldValue, rateLimit } from '#lib/server/validate.js';

export function load({ params }) {
	const { tray, state } = loadTray(params.id);
	const { steps, fields, involved, components, exceptions } = state;
	return {
		tray,
		state: { steps, fields, involved, components, exceptions },
		issues: completionIssues(state),
		mass: totalMass(state),
		passed: passedCount(state),
		total: STEPS.length
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
	const { tray, state } = loadTray(params.id);
	try {
		const reason = text(data.get('reason'), 300, { label: 'Reason for revision' });
		const entries = [build(data, state, locals.person)].flat();
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

export const actions = {
	step: act((data, state) => {
		const n = oneOf(data.get('step'), Object.keys(STEP_BY_N), 'Step');
		const result = oneOf(data.get('result'), ['P', 'F'], 'Result');
		const comment = text(data.get('comment'), 500, { label: 'Comment' });
		if (result === 'P') {
			const missing = stepNeeds(STEP_BY_N[n]).filter((k) => !state.fields[k]);
			if (missing.length) throw new Invalid(`Step ${n}: record first — ${missing.map((k) => FIELDS[k].label).join(', ')}`);
			if (STEP_BY_N[n].fields?.includes('foamLayers') && foamAlarm(state.fields)) throw new Invalid(`Step ${n}: ${FOAM_ALARM}`);
			return { kind: 'step', key: n, payload: { result, comment } };
		}
		if (!comment) throw new Invalid(`Step ${n}: describe the problem when marking Fail.`);
		// A failure also opens an exception entry (section 5).
		return [
			{ kind: 'step', key: n, payload: { result, comment } },
			{ kind: 'exception', key: 'ex-' + randomUUID(), payload: { step: n, issue: comment, action: '' } }
		];
	}),

	field: act((data, state) => {
		const key = oneOf(data.get('key'), Object.keys(FIELDS), 'Field');
		const value = fieldValue(FIELDS[key], data.get('value'), getPerson);
		const other = { workLead: 'reviewer', reviewer: 'workLead' }[key];
		if (other && state.fields[other]?.payload.value === value.value) throw new Invalid('Work lead and reviewer must be different people.');
		if (key === 'status' && value.value === 'Complete') {
			const issues = completionIssues(state);
			if (issues.length) throw new Invalid('Cannot complete: ' + issues.join('; '));
		}
		return { kind: 'field', key, payload: value };
	}),

	involve: act((data, state, me) => {
		const id = Number(data.get('person'));
		const person = Number.isInteger(id) ? getPerson(id) : null;
		if (!person) throw new Invalid('Select a registered name.');
		const active = data.get('active') !== 'no';
		// Removing someone needs the tray's reviewer.
		if (!active && state.fields.reviewer?.payload.value !== me.id)
			throw new Invalid('Only the assigned reviewer can mark someone as not involved.');
		// Role comes from registration only.
		return { kind: 'involved', key: String(person.id), payload: { name: person.name, role: person.role, active } };
	}),

	component: act((data) => {
		const key = oneOf(data.get('key'), Object.keys(COMPONENTS), 'Component');
		const remarks = text(data.get('remarks'), 200, { label: 'Remarks' });
		return { kind: 'component', key, payload: { accounted: data.get('accounted') === 'yes', remarks } };
	}),

	exception: act((data, state) => {
		const raw = data.get('key');
		const key = raw ? oneOf(raw, state.exceptions.map((x) => x.key), 'Exception') : 'ex-' + randomUUID();
		const step = data.get('step') ? oneOf(data.get('step'), Object.keys(STEP_BY_N), 'Step') : '';
		const issue = text(data.get('issue'), 500, { label: 'Issue', required: true });
		const action = text(data.get('action'), 500, { label: 'Action / recheck result' });
		return { kind: 'exception', key, payload: { step, issue, action } };
	})
};
