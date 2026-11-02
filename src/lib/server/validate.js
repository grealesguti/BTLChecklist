import { allowedPerson } from '#lib/checklist.js';

/** Thrown for user input problems; turned into a 400 with the message shown. */
export class Invalid extends Error {}

// Control characters (except tab/newline/CR), invisible format characters
// (zero-width, bidi overrides, BOM) and Unicode line/paragraph separators.
const CTRL = /(?![\t\n\r])[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

/** Plain-text cleanup: NFC, strip controls, collapse whitespace, enforce max length. */
export function text(v, max, { multiline = false, required = false, label = 'Value' } = {}) {
	if (v != null && typeof v !== 'string') throw new Invalid(`${label}: invalid value`);
	let s = (v ?? '').normalize('NFC').replace(CTRL, '');
	s = multiline
		? s.replace(/\r\n?/g, '\n').replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
		: s.replace(/\s+/g, ' ').trim();
	if (required && !s) throw new Invalid(`${label} is required`);
	if (s.length > max) throw new Invalid(`${label}: max ${max} characters`);
	return s;
}

const NAME_RE = /^\p{L}[\p{L}\p{M} .'’\-]{1,59}$/u;
export function personName(v) {
	const s = text(v, 60, { label: 'Name', required: true });
	if (!NAME_RE.test(s)) throw new Invalid("Name: 2–60 characters; letters, spaces and . ' - only");
	return s;
}

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
export function username(v) {
	const s = text(v, 32, { label: 'Username', required: true }).toLowerCase();
	if (!USERNAME_RE.test(s)) throw new Invalid('Username: 3–32 characters; letters, digits, . _ - only');
	return s;
}

/** Taken as typed (no trimming): spaces and any characters are allowed. */
export function password(v) {
	if (typeof v !== 'string' || v.length < 8 || v.length > 200) throw new Invalid('Password: 8–200 characters');
	return v;
}

const DESIGNATION_RE =/^[A-Za-z0-9][A-Za-z0-9 ._\-]{0,39}$/;
export function designation(v) {
	const s = text(v, 40, { label: 'Tray designation', required: true });
	if (!DESIGNATION_RE.test(s)) throw new Invalid('Tray designation: letters, digits, space . _ - only (max 40)');
	return s;
}

/** Validates a checklist field value against its definition. Empty values are rejected: nothing can be cleared. */
export function fieldValue(def, raw, findPerson) {
	const max = def.type === 'long' ? 1000 : def.type === 'url' ? 300 : 100;
	const s = text(raw, max, { multiline: def.type === 'long', label: def.label, required: true });
	switch (def.type) {
		case 'int':
		case 'num': {
			const ok = def.type === 'int' ? /^\d+$/.test(s) : /^\d+([.,]\d+)?$/.test(s);
			const n = Number(s.replace(',', '.'));
			if (!ok || n < def.min || n > def.max)
				throw new Invalid(`${def.label}: ${def.type === 'int' ? 'whole number' : 'number'} from ${def.min} to ${def.max}`);
			return { value: n };
		}
		case 'select':
			if (!def.options.includes(s)) throw new Invalid(`${def.label}: invalid option`);
			return { value: s };
		case 'person': {
			const p = /^\d+$/.test(s) ? findPerson(Number(s)) : null;
			if (!p) throw new Invalid(`${def.label}: select a registered name`);
			if (def.allowed && !allowedPerson(def, p)) throw new Invalid(`${def.label}: only ${def.allowed.join(' or ')}`);
			return { value: p.id, name: p.name };
		}
		case 'check':
			if (s !== 'Passed') throw new Invalid(`${def.label}: invalid value`);
			return { value: s };
		case 'date':
			if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || new Date(Date.parse(s) || 0).toISOString().slice(0, 10) !== s)
				throw new Invalid(`${def.label}: invalid date`);
			return { value: s };
		case 'url': {
			let u;
			try {
				u = new URL(s);
			} catch {}
			if (!u || u.protocol !== 'https:') throw new Invalid(`${def.label}: must be an https:// link`);
			return { value: u.href };
		}
		default:
			return { value: s };
	}
}

/** Only same-site relative paths, so a form can't redirect users elsewhere. */
export const safeBack = (v) => (typeof v === 'string' && /^\/(?!\/)[A-Za-z0-9/_.-]*$/.test(v) ? v : '/');

const hits = new Map();
// ponytail: in-memory per process, resets on restart; fine for one server.
export function rateLimit(key, max, ms) {
	const now = Date.now();
	const recent = (hits.get(key) ?? []).filter((t) => now - t < ms);
	if (recent.length >= max) return false;
	recent.push(now);
	hits.set(key, recent);
	return true;
}
