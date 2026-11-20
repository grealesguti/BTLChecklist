import { anyDbRoot, currentContact } from '#lib/server/db.js';

// Server settings that live only in the database / .env (never in git), prompted for when missing.
const envRoots = () => (process.env.ROOT_USERS ?? '').split(',').some((u) => u.trim());

/** What is still missing: noRoot (anyone logged in may fill it), noContact (only a root user may). */
export function missingSettings() {
	return { noRoot: !envRoots() && !anyDbRoot(), noContact: !currentContact() };
}

/** True when this logged-in user should be sent to /setup. */
export function setupNeeded(locals) {
	const m = missingSettings();
	return m.noRoot || (m.noContact && locals.root);
}
