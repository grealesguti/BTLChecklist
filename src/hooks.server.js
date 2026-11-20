import { dev } from '$app/env';
import { accessEmail } from '#lib/server/access.js';
import { sessionPerson, dbRoot } from '#lib/server/db.js';
import { tokenHash } from '#lib/server/auth.js';
import { setupNeeded } from '#lib/server/setup.js';

// ACCESS_MODE=cloudflare (default): Cloudflare Access must vouch for a @cern.ch email.
// ACCESS_MODE=login: behind another proxy (e.g. NPMplus); the app's own login is the only gate,
// and the client IP stands in for the email in the log.
const loginOnly = process.env.ACCESS_MODE === 'login';
// Root users: listed here (.env on the server) or created in the app (first user's setup / granted by a root).
const ROOT_USERS = (process.env.ROOT_USERS ?? '').split(',').map((u) => u.trim().toLowerCase()).filter(Boolean);

if (!dev && !loginOnly && !(process.env.CF_ACCESS_TEAM_DOMAIN && process.env.CF_ACCESS_AUD))
	console.error('CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD not set: every request will be refused (or set ACCESS_MODE=login).');

// Pages reachable without logging in. Everything else (pages, form actions, photos, downloads) needs a login.
const PUBLIC = new Set(['/login']);

/** Redirect that works for normal page loads and for SvelteKit's JSON form submissions. */
function goTo(event, location) {
	if (event.request.headers.get('accept')?.includes('application/json'))
		return Response.json({ type: 'redirect', status: 303, location });
	return new Response(null, { status: 303, headers: { location } });
}

export async function handle({ event, resolve }) {
	const email = loginOnly ? 'ip:' + event.getClientAddress() : await accessEmail(event.request.headers, dev);
	if (!email) return new Response('Forbidden', { status: 403 });
	event.locals.email = email;

	// Logged-in person from the session cookie (username + password login).
	const token = event.cookies.get('session');
	const person = token ? (sessionPerson(tokenHash(token)) ?? null) : null;
	event.locals.person = person;
	event.locals.root = !!person && ((!!person.username && ROOT_USERS.includes(person.username)) || dbRoot(person.id));

	const path = event.url.pathname;
	if (!person && !PUBLIC.has(path)) return goTo(event, '/login?back=' + encodeURIComponent(path + event.url.search));
	// Missing settings on a new server (or after a database without them): the first logged-in user
	// creates the root user; a root user is asked for the contact details while they are missing.
	if (person && path !== '/setup' && path !== '/login' && setupNeeded(event.locals)) return goTo(event, '/setup');

	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'same-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	return response;
}
