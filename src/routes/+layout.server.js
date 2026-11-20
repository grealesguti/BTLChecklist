import { listPeople, currentContact } from '#lib/server/db.js';

export function load({ locals }) {
	// Contact is shown on every page, also the login page (whom to call if you cannot log in).
	const c = currentContact();
	const contact = c ? { name: c.name, phone: c.phone, email: c.email } : null;
	if (!locals.person) return { me: null, people: [], contact, root: false, email: locals.email };
	return { people: listPeople(), me: locals.person, email: locals.email, root: locals.root, contact };
}
