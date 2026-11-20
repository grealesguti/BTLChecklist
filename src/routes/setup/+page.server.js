import { fail, redirect } from '@sveltejs/kit';
import { addRoot, setContact } from '#lib/server/db.js';
import { Invalid, contact } from '#lib/server/validate.js';
import { missingSettings, setupNeeded } from '#lib/server/setup.js';

// Prompted on a new server, or when settings are missing from the database:
// - no root user (none in the database, ROOT_USERS empty): the first logged-in user becomes root;
// - no contact details: a root user enters them (shown on every page).
export function load({ locals }) {
	if (!setupNeeded(locals)) redirect(303, '/');
	return missingSettings();
}

export const actions = {
	default: async ({ request, locals }) => {
		if (!setupNeeded(locals)) return fail(400, { error: 'Nothing to set up, or only a root user can do it.' });
		const { noRoot } = missingSettings();
		const data = await request.formData();
		try {
			const c = contact(data);
			if (noRoot) addRoot(locals.person.id, locals.person.id);
			setContact(c, locals.person.id);
		} catch (e) {
			if (e instanceof Invalid) return fail(400, { error: e.message });
			throw e;
		}
		redirect(303, '/');
	}
};
