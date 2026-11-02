import { fail, redirect } from '@sveltejs/kit';
import { REVISION, STEPS } from '#lib/checklist.js';
import { listTrays, trayEvents, addPerson, addTray, getLogin, createSession, deleteSession, findByName, setLogin } from '#lib/server/db.js';
import { deriveState, passedCount, fieldText } from '#lib/server/state.js';
import { Invalid, personName, designation, safeBack, rateLimit, text, username, password } from '#lib/server/validate.js';
import { hashPassword, checkPassword, newToken, tokenHash, SESSION_MS } from '#lib/server/auth.js';

function startSession(cookies, personId) {
	const token = newToken();
	createSession(tokenHash(token), personId, new Date(Date.now() + SESSION_MS).toISOString());
	cookies.set('session', token, { path: '/', httpOnly: true, sameSite: 'strict', maxAge: SESSION_MS / 1000 });
}

export function load() {
	// ponytail: replays every tray's log per request; cache if trays reach the thousands.
	const trays = listTrays().map((tray) => {
		const state = deriveState(trayEvents(tray.id));
		return {
			...tray,
			status: fieldText(state.fields.status) || 'In progress',
			passed: passedCount(state),
			last: state.log.at(-1)?.at ?? tray.created_at
		};
	});
	return { trays, total: STEPS.length };
}

export const actions = {
	login: async ({ request, cookies, locals }) => {
		const data = await request.formData();
		const user = String(data.get('username') ?? '').trim().toLowerCase().slice(0, 32);
		if (!rateLimit('login:' + locals.email, 20, 15 * 60_000) || !rateLimit('login-user:' + user, 10, 15 * 60_000))
			return fail(429, { error: 'Too many login attempts, wait 15 minutes.' });
		const login = getLogin(user);
		if (!checkPassword(data.get('password'), login?.pass_hash)) return fail(400, { error: 'Wrong username or password.' });
		startSession(cookies, login.id);
		redirect(303, safeBack(data.get('back')));
	},

	logout: async ({ request, cookies }) => {
		const data = await request.formData();
		const token = cookies.get('session');
		if (token) deleteSession(tokenHash(token));
		cookies.delete('session', { path: '/' });
		redirect(303, safeBack(data.get('back')));
	},

	/** Self-registration with a password; also sets the password of a name added earlier without a login. */
	registerPerson: async ({ request, cookies, locals }) => {
		const data = await request.formData();
		if (!rateLimit('register:' + locals.email, 10, 3600_000)) return fail(429, { error: 'Too many new names this hour.' });
		let person;
		try {
			const name = personName(data.get('name'));
			const user = username(data.get('username'));
			const pass = password(data.get('password'));
			if (pass !== data.get('password2')) throw new Invalid('The two passwords do not match.');
			if (getLogin(user)) throw new Invalid('That username is taken.');
			person = findByName(name);
			if (person?.has_login) throw new Invalid('This name already has a login. Log in instead.');
			const role = text(data.get('role'), 40, { label: 'Role', required: !person?.role });
			person ??= addPerson(name, role, locals.email);
			if (!setLogin(person.id, user, hashPassword(pass), role)) throw new Invalid('This name already has a login. Log in instead.');
		} catch (e) {
			if (e instanceof Invalid) return fail(400, { error: e.message });
			throw e;
		}
		startSession(cookies, person.id);
		redirect(303, safeBack(data.get('back')));
	},

	/** A logged-in user adds someone by name only: listed, but cannot log in or sign until they set a password. */
	addPersonNoLogin: async ({ request, locals }) => {
		if (!locals.person) return fail(400, { error: 'Log in first (top of the page).' });
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
		if (!locals.person) return fail(400, { error: 'Log in first (top of the page).' });
		if (!rateLimit('tray:' + locals.email, 20, 3600_000)) return fail(429, { error: 'Too many new trays this hour.' });
		const data = await request.formData();
		let id;
		try {
			id = addTray(designation(data.get('designation')), locals.person.id, locals.email, REVISION);
		} catch (e) {
			if (e instanceof Invalid) return fail(400, { error: e.message });
			throw e;
		}
		if (!id) return fail(400, { error: 'A tray with this designation already exists.' });
		redirect(303, `/tray/${id}`);
	}
};
