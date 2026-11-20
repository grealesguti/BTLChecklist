import { fail, redirect } from '@sveltejs/kit';
import { addPerson, getLogin, createSession, deleteSession, findByName, setLogin, anyLogin } from '#lib/server/db.js';
import { Invalid, personName, safeBack, rateLimit, text, username, password } from '#lib/server/validate.js';
import { hashPassword, checkPassword, newToken, tokenHash, SESSION_MS } from '#lib/server/auth.js';
import { missingSettings } from '#lib/server/setup.js';

function startSession(cookies, personId) {
	const token = newToken();
	createSession(tokenHash(token), personId, new Date(Date.now() + SESSION_MS).toISOString());
	cookies.set('session', token, { path: '/', httpOnly: true, sameSite: 'strict', maxAge: SESSION_MS / 1000 });
}

export function load({ locals, url }) {
	if (locals.person) redirect(303, safeBack(url.searchParams.get('back')));
	return { back: safeBack(url.searchParams.get('back')), firstUser: !anyLogin(), noRoot: missingSettings().noRoot };
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

	logout: async ({ cookies }) => {
		const token = cookies.get('session');
		if (token) deleteSession(tokenHash(token));
		cookies.delete('session', { path: '/' });
		redirect(303, '/login');
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
	}
};
