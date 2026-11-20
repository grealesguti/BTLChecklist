import { error, fail } from '@sveltejs/kit';
import { CHECKLISTS } from '#lib/checklists/index.js';
import { peopleOverview, personEvents, contactHistory, setContact, addRoot, dbRoot, getPerson } from '#lib/server/db.js';
import { describe } from '#lib/server/state.js';
import { Invalid, contact } from '#lib/server/validate.js';

// Root only. Shows what is stored about each person (never password hashes); edits the contact
// details shown on every page (each change kept as history); grants root to another person.
export function load({ locals, url }) {
	if (!locals.root) error(404, 'Not found');
	const people = peopleOverview().map((p) => ({ ...p, root: dbRoot(p.id) }));
	const id = Number(url.searchParams.get('id'));
	const person = people.find((p) => p.id === id) ?? null;
	const entries = person
		? personEvents(person.id).map((e) => {
				const cl = CHECKLISTS[e.checklist];
				return { ...e, checklistTitle: cl?.title ?? e.checklist, d: cl ? describe(e, cl) : { item: e.key, value: '', note: '' } };
			})
		: [];
	return { people, person, entries, contacts: contactHistory() };
}

const rootOnly = (fn) => async (event) => {
	if (!event.locals.root) error(404, 'Not found');
	try {
		return await fn(event);
	} catch (e) {
		if (e instanceof Invalid) return fail(400, { error: e.message });
		throw e;
	}
};

export const actions = {
	contact: rootOnly(async ({ request, locals }) => {
		setContact(contact(await request.formData()), locals.person.id);
		return { ok: true };
	}),
	grantRoot: rootOnly(async ({ request, locals }) => {
		const p = getPerson(Number((await request.formData()).get('person')));
		if (!p) throw new Invalid('Select a registered name.');
		addRoot(p.id, locals.person.id);
		return { ok: true };
	})
};
