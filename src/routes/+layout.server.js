import { listPeople } from '#lib/server/db.js';

export function load({ locals }) {
	return { people: listPeople(), me: locals.person, email: locals.email };
}
