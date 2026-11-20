/**
 * Field types: text (max 100), long (max 1000, multiline), int/num (min..max),
 * select (options), person (registered name; `allowed` limits it to those names), url (https only),
 * date (YYYY-MM-DD; prefilled with today unless `noDefault`),
 * check (a tick, stored as 'Passed'; like every field it can't be cleared, record a failure as an exception).
 */
export const COMMON_FIELDS = {
	workDates: { label: 'Work date', type: 'date' },
	cernboxLink: { label: 'CERNbox file / folder link', type: 'url' },
	workLead: { label: 'Work lead', type: 'person' },
	reviewer: { label: 'Reviewer', type: 'person' },
	status: { label: 'Status', type: 'select', options: ['In progress', 'On hold', 'Complete'] }
};
export const COMPLETION_FIELDS = ['workLead', 'reviewer', 'cernboxLink', 'status'];

// Reference links used by several checklists (step `links`).
export const LINKS = {
	dp490Tds: { label: 'DP490 technical data sheet (3M)', url: 'https://multimedia.3m.com/mws/media/2534142O/3m-scotch-weld-epoxy-adhesive-dp490-technical-data-sheet.pdf' },
	dp490Page: { label: 'DP490 product page with safety data sheet (3M)', url: 'https://3m.co.uk/3M/en_GB/p/d/b40066473' },
	resistorDatasheet: { label: 'Resistor datasheet, Bourns PWR221T-30', url: 'https://www.bourns.com/docs/product-datasheets/pwr221t-30.pdf' },
	cernSafety: { label: 'CERN HSE (safety rules)', url: 'https://hse.cern' }
};
export const EMERGENCY = 'CERN emergency: 74444 (from a mobile: +41 22 767 4444)';

export const allowedPerson = (def, p) => !def.allowed || def.allowed.some((n) => n.toLocaleLowerCase('en') === p.name.toLocaleLowerCase('en'));

// A step's own `fields` are shown inside the step and, with `requires`, must be recorded before it can pass.
export const stepNeeds = (st) => [...(st.requires ?? []), ...(st.fields ?? [])];
// Every field belonging to a section, in step order, for the printable record / export.
export const sectionFields = (section) => [...section.steps.flatMap((st) => st.fields ?? []), ...(section.fields ?? [])];

/**
 * A step picture: 'file.jpg' (this checklist's images/), '<other id>/file.jpg' (reuse another checklist's),
 * or { f, caption, avoid, marks: [[x%, y%, label]] }. Files named TOAVOID_… are shown as "to avoid",
 * NOTPROCEDURAL_… as reference only. Returns { path, caption, avoid, marks } with path '<id>/images/<file>'.
 */
export function imageRef(entry, clId) {
	const e = typeof entry === 'string' ? { f: entry } : entry;
	const [id, file] = e.f.includes('/') ? e.f.split('/') : [clId, e.f];
	const auto = file
		.replace(/\.\w+$/, '')
		.replace(/^(TOAVOID|NOTPROCEDURAL)_/, '')
		.replace(/_/g, ' — ')
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
	const avoid = e.avoid ?? file.startsWith('TOAVOID_');
	const caption = e.caption ?? (file.startsWith('NOTPROCEDURAL_') ? `Reference only: ${auto}` : auto);
	return { path: `${id}/images/${file}`, caption, avoid, marks: e.marks ?? [] };
}

/** Curing steps (`wait: { after, hours }`): ms timestamp when they may pass, or null while `after` is not passed. */
export function readyAt(st, steps) {
	const a = steps[st.wait.after];
	return a?.payload.result === 'P' ? Date.parse(a.at) + st.wait.hours * 3600_000 : null;
}
