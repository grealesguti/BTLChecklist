import { dev } from '$app/env';
import { accessEmail } from '#lib/server/access.js';
import { sessionPerson } from '#lib/server/db.js';
import { tokenHash } from '#lib/server/auth.js';

// ACCESS_MODE=cloudflare (default): Cloudflare Access must vouch for a @cern.ch email.
// ACCESS_MODE=login: behind another proxy (e.g. NPMplus); the app's own login is the only gate,
// and the client IP stands in for the email in the log.
const loginOnly = process.env.ACCESS_MODE === 'login';

if (!dev && !loginOnly && !(process.env.CF_ACCESS_TEAM_DOMAIN && process.env.CF_ACCESS_AUD))
	console.error('CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD not set: every request will be refused (or set ACCESS_MODE=login).');

export async function handle({ event, resolve }) {
	const email = loginOnly ? 'ip:' + event.getClientAddress() : await accessEmail(event.request.headers, dev);
	if (!email) return new Response('Forbidden', { status: 403 });
	event.locals.email = email;

	// Logged-in person from the session cookie (username + password login).
	const token = event.cookies.get('session');
	event.locals.person = token ? (sessionPerson(tokenHash(token)) ?? null) : null;

	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'same-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	return response;
}
