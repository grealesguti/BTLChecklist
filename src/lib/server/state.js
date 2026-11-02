import { FIELDS, STEPS, COMPONENTS, REQUIRED_FOR_COMPLETION, foamAlarm, FOAM_ALARM } from '#lib/checklist.js';

/**
 * Replays the append-only log. Each (kind, key) is one item; every later entry
 * for the same item is a revision of it. Nothing is ever dropped from `log`.
 */
export function deriveState(events) {
	const items = new Map();
	const log = events.map((e) => {
		const prev = items.get(e.kind + ':' + e.key);
		const entry = { ...e, rev: prev ? prev.rev + 1 : 1, supersedes: prev?.id ?? null };
		items.set(e.kind + ':' + e.key, entry);
		return entry;
	});
	const current = [...items.values()];
	const ids = new Set(current.map((a) => a.id));
	for (const a of log) a.current = ids.has(a.id);
	const pick = (kind) => Object.fromEntries(current.filter((a) => a.kind === kind).map((a) => [a.key, a]));
	return {
		log,
		items,
		steps: pick('step'),
		fields: pick('field'),
		involved: pick('involved'),
		components: pick('component'),
		exceptions: current.filter((a) => a.kind === 'exception')
	};
}

export const fieldText = (entry) => (entry ? String(entry.payload.name ?? entry.payload.value) : '');

export function totalMass(s) {
	const a = s.fields.scale1Kg?.payload.value, b = s.fields.scale2Kg?.payload.value;
	return a != null && b != null ? Math.round((a + b) * 1000) / 1000 : null;
}

export const activePeople = (s) => Object.values(s.involved).filter((a) => a.payload.active);
export const passedCount = (s) => STEPS.filter((st) => s.steps[st.n]?.payload.result === 'P').length;

export function completionIssues(s) {
	const issues = [];
	const open = STEPS.length - passedCount(s);
	if (open) issues.push(`${open} step(s) not passed`);
	if (activePeople(s).length < 3) issues.push('At least three people involved');
	if (foamAlarm(s.fields)) issues.push(FOAM_ALARM);
	for (const k of REQUIRED_FOR_COMPLETION) if (!s.fields[k]) issues.push(`${FIELDS[k].label} missing`);
	if (s.fields.workLead && s.fields.workLead.payload.value === s.fields.reviewer?.payload.value)
		issues.push('Work lead and reviewer must be different people');
	const notAccounted = Object.keys(COMPONENTS).filter((k) => !s.components[k]?.payload.accounted);
	if (notAccounted.length) issues.push(`${notAccounted.length} component(s) not accounted for`);
	const unresolved = s.exceptions.filter((e) => !e.payload.action).length;
	if (unresolved) issues.push(`${unresolved} exception(s) without corrective action`);
	return issues;
}

/** Human-readable { type, item, value, note } for logs and exports. */
export function describe(e) {
	const p = e.payload;
	switch (e.kind) {
		case 'step':
			return { type: 'Step', item: `Step ${e.key}`, value: p.result === 'P' ? 'Pass' : 'Fail', note: p.comment ?? '' };
		case 'field':
			return { type: 'Field', item: FIELDS[e.key]?.label ?? e.key, value: fieldText(e), note: '' };
		case 'involved':
			return { type: 'People involved', item: p.name, value: p.active ? p.role : 'Marked not involved', note: '' };
		case 'component':
			return { type: 'Component', item: COMPONENTS[e.key] ?? e.key, value: p.accounted ? 'Accounted for' : 'Not accounted for', note: p.remarks ?? '' };
		case 'exception':
			return { type: 'Exception', item: p.step ? `Exception (step ${p.step})` : 'Exception', value: p.issue, note: p.action ? `Action: ${p.action}` : '' };
		default:
			return { type: e.kind, item: e.key, value: '', note: '' };
	}
}
