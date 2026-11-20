// Every checklist the app knows, one folder each: <id>/checklist.js (steps and fields),
// <id>/images/ (step pictures, referenced by file name, or '<other id>/<file>' to reuse another
// checklist's picture), <id>/docs/ (source documents).
// To add one: copy a folder, change its id, and list it here and in CHAIN.
// The id is stored with each record, so never rename an id once records exist.
import { COMMON_FIELDS } from './common.js';
import tray from './tray/checklist.js';
import sensor from './sensor/checklist.js';
import preheater from './preheater/checklist.js';
import assembly from './pipeclampandpreheaterassembly/checklist.js';

// Process order for one tray. Insertion is always last (before commissioning).
// Every record warns when an earlier process of the same tray is missing or not Complete.
export const CHAIN = ['sensor', 'preheater', 'pipeclampandpreheaterassembly', 'tray'];

function prepare(c) {
	const STEPS = c.SECTIONS.flatMap((s) => s.steps);
	const COMPONENTS = c.COMPONENTS ?? {};
	const at = CHAIN.indexOf(c.id);
	// Fixed sections after the checklist's own ones; components only if it has any.
	let n = c.SECTIONS.length;
	const T = {
		components: Object.keys(COMPONENTS).length ? `${++n}. Component accounting and storage` : null,
		exceptions: `${++n}. Exceptions and corrective actions`,
		completion: `${++n}. Completion review`
	};
	return {
		derived: [],
		refTables: [],
		minPeople: 1,
		...c,
		knownIssues: [...(c.knownIssues ?? []), { type: 'Other (describe below)', hint: '' }],
		after: at > 0 ? CHAIN[at - 1] : null, // the process right before (steps with `previous: true` need it Complete)
		prior: at > 0 ? CHAIN.slice(0, at) : [], // all earlier processes (warnings)
		FIELDS: { ...c.FIELDS, ...COMMON_FIELDS },
		COMPONENTS,
		STEPS,
		STEP_BY_N: Object.fromEntries(STEPS.map((s) => [s.n, s])),
		T
	};
}

export const CHECKLISTS = Object.fromEntries([sensor, preheater, assembly, tray].map((c) => [c.id, prepare(c)]));
export const DEFAULT_CHECKLIST = 'tray';
// hasOwn: '__proto__' / 'constructor' from a URL must not resolve to anything.
export const isChecklist = (id) => typeof id === 'string' && Object.hasOwn(CHECKLISTS, id);
