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
		exceptions: current.filter((a) => a.kind === 'exception'),
		photos: current.filter((a) => a.kind === 'photo')
	};
}

export const fieldText = (entry) => (entry ? String(entry.payload.name ?? entry.payload.value) : '');
export const statusText = (s) => fieldText(s.fields.status) || 'In progress';

export const activePeople = (s) => Object.values(s.involved).filter((a) => a.payload.active);
export const passedCount = (s, cl) => cl.STEPS.filter((st) => s.steps[st.n]?.payload.result === 'P').length;

export function completionIssues(s, cl) {
	const issues = [];
	const open = cl.STEPS.length - passedCount(s, cl);
	if (open) issues.push(`${open} step(s) not passed`);
	if (activePeople(s).length < cl.minPeople) issues.push(`At least ${cl.minPeople} people involved`);
	for (const alarm of [cl.alarm?.(s.fields), ...cl.STEPS.map((st) => st.alarm?.(s.fields))]) if (alarm) issues.push(alarm);
	for (const k of cl.REQUIRED_FOR_COMPLETION) if (!s.fields[k]) issues.push(`${cl.FIELDS[k].label} missing`);
	if (s.fields.workLead && s.fields.workLead.payload.value === s.fields.reviewer?.payload.value)
		issues.push('Work lead and reviewer must be different people');
	const notAccounted = Object.keys(cl.COMPONENTS).filter((k) => !s.components[k]?.payload.accounted);
	if (notAccounted.length) issues.push(`${notAccounted.length} component(s) not accounted for`);
	const unresolved = s.exceptions.filter((e) => !e.payload.action).length;
	if (unresolved) issues.push(`${unresolved} exception(s) without corrective action`);
	return issues;
}

/** Non-blocking: things a reviewer should look at before signing (e.g. steps passed without the expected photo). */
export function completionWarnings(s, cl) {
	const noPhoto = cl.STEPS.filter((st) => st.photo && s.steps[st.n]?.payload.result === 'P' && !s.photos.some((p) => p.payload.step === st.n));
	return noPhoto.length ? [`Passed without the expected photo: step ${noPhoto.map((st) => st.n).join(', ')}`] : [];
}

/** Human-readable { type, item, value, note } for logs and exports. */
export function describe(e, cl) {
	const p = e.payload;
	switch (e.kind) {
		case 'step':
			return { type: 'Step', item: `Step ${e.key}`, value: p.result === 'P' ? 'Pass' : 'Fail', note: [p.checkedByName && `second check: ${p.checkedByName}`, p.comment].filter(Boolean).join(' · ') };
		case 'field':
			return { type: 'Field', item: cl.FIELDS[e.key]?.label ?? e.key, value: fieldText(e), note: '' };
		case 'involved':
			return { type: 'People involved', item: p.name, value: p.active ? p.role : 'Marked not involved', note: '' };
		case 'component':
			return { type: 'Component', item: cl.COMPONENTS[e.key] ?? e.key, value: p.accounted ? 'Accounted for' : 'Not accounted for', note: p.remarks ?? '' };
		case 'exception':
			return { type: 'Exception', item: p.step ? `Exception (step ${p.step})` : 'Exception', value: p.issue, note: p.action ? `Action: ${p.action}` : '' };
		case 'photo':
			return { type: 'Photo', item: `Photo (step ${p.step})`, value: p.name || p.file, note: [p.caption, `sha256 ${p.sha256}`].filter(Boolean).join(' · ') };
		default:
			return { type: e.kind, item: e.key, value: '', note: '' };
	}
}
