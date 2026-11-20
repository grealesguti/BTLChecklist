// Proves a new version leaves stored data untouched. Run it on a COPY of the server database
// before deploying:   node scripts/check-upgrade.mjs tmp/checklist-copy.db
// It hashes every existing row, opens the copy with this version's db.js (which applies any
// schema upgrade), hashes again and fails if anything changed. New columns are ignored.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const path = process.argv[2];
if (!path) throw new Error('usage: node scripts/check-upgrade.mjs <copy of checklist.db>');
const KEYS = { people: 'id', trays: 'id', events: 'id' };

function snapshot(cols) {
	const d = new DatabaseSync(path);
	const out = {};
	for (const [t, key] of Object.entries(KEYS)) {
		cols[t] ??= d.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
		const rows = d.prepare(`SELECT ${cols[t].join(',')} FROM ${t} ORDER BY ${key}`).all();
		out[t] = { rows: rows.length, sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
	}
	d.close();
	return out;
}

const cols = {};
const before = snapshot(cols);
process.env.DB_PATH = resolve(path);
const db = await import('#lib/server/db.js');
db.listPeople(); // opens the database = runs the upgrade
const after = snapshot(cols);
console.table(before);
assert.deepEqual(after, before, 'existing rows changed');
console.log('OK: every existing row of people, trays and events is unchanged.');
