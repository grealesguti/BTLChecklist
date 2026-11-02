import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Append-only: the database itself refuses UPDATE/DELETE on recorded data.
const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS people (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	name_key TEXT NOT NULL UNIQUE,
	role TEXT NOT NULL DEFAULT '',
	username TEXT,
	pass_hash TEXT,
	created_at TEXT NOT NULL,
	created_by_email TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
	token_hash TEXT PRIMARY KEY,
	person_id INTEGER NOT NULL REFERENCES people(id),
	expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS trays (
	id INTEGER PRIMARY KEY,
	designation TEXT NOT NULL,
	designation_key TEXT NOT NULL UNIQUE,
	checklist_rev TEXT NOT NULL,
	created_by INTEGER NOT NULL REFERENCES people(id),
	email TEXT NOT NULL,
	created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
	id INTEGER PRIMARY KEY,
	tray_id INTEGER NOT NULL REFERENCES trays(id),
	person_id INTEGER NOT NULL REFERENCES people(id),
	email TEXT NOT NULL,
	at TEXT NOT NULL,
	kind TEXT NOT NULL,
	key TEXT NOT NULL,
	payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_tray ON events(tray_id, id);
CREATE TRIGGER IF NOT EXISTS events_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS events_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS trays_no_update BEFORE UPDATE ON trays BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS trays_no_delete BEFORE DELETE ON trays BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS people_no_delete BEFORE DELETE ON people BEGIN SELECT RAISE(ABORT, 'append-only'); END;
`;

let db;
function open() {
	const path = process.env.DB_PATH || 'data/checklist.db';
	mkdirSync(dirname(path), { recursive: true });
	const d = new DatabaseSync(path);
	d.exec(SCHEMA);
	// Databases created before roles / logins existed.
	const cols = d.prepare('PRAGMA table_info(people)').all().map((c) => c.name);
	if (!cols.includes('role')) d.exec("ALTER TABLE people ADD COLUMN role TEXT NOT NULL DEFAULT ''");
	if (!cols.includes('username')) d.exec('ALTER TABLE people ADD COLUMN username TEXT; ALTER TABLE people ADD COLUMN pass_hash TEXT;');
	d.exec('CREATE UNIQUE INDEX IF NOT EXISTS people_username ON people(username)');
	return d;
}

// Prepared statements only: values are always bound, never concatenated into SQL.
const q = (sql) => (db ??= open()).prepare(sql);
const now = () => new Date().toISOString();
const plain = (row) => (row ? { ...row } : undefined);

export const listPeople = () => q('SELECT id, name, role FROM people ORDER BY name COLLATE NOCASE').all().map(plain);
export const getPerson = (id) => plain(q('SELECT id, name, role FROM people WHERE id = ?').get(id));

export const getLogin = (username) => plain(q('SELECT id, name, role, pass_hash FROM people WHERE username = ?').get(username));

export const findByName = (name) =>
	plain(q('SELECT id, name, role, pass_hash IS NOT NULL AS has_login FROM people WHERE name_key = ?').get(name.toLocaleLowerCase('en')));

/** Adds a name (no login yet). Returns null if the name is already registered (case-insensitive). */
export function addPerson(name, role, email) {
	if (findByName(name)) return null;
	const r = q('INSERT INTO people (name, name_key, role, created_at, created_by_email) VALUES (?, ?, ?, ?, ?)').run(
		name, name.toLocaleLowerCase('en'), role, now(), email
	);
	return { id: Number(r.lastInsertRowid), name, role };
}

/** Gives a name without a login its username + password, once. Returns false if it already has one. */
export function setLogin(id, username, passHash, role) {
	const r = q("UPDATE people SET username = ?, pass_hash = ?, role = CASE role WHEN '' THEN ? ELSE role END WHERE id = ? AND pass_hash IS NULL").run(
		username, passHash, role, id
	);
	return r.changes === 1;
}

// Sessions: only a hash of the cookie token is stored.
export function createSession(tokenHash, personId, expiresAt) {
	q('DELETE FROM sessions WHERE expires_at < ?').run(now());
	q('INSERT INTO sessions (token_hash, person_id, expires_at) VALUES (?, ?, ?)').run(tokenHash, personId, expiresAt);
}
export const sessionPerson = (tokenHash) =>
	plain(q('SELECT p.id, p.name, p.role FROM sessions s JOIN people p ON p.id = s.person_id WHERE s.token_hash = ? AND s.expires_at > ?').get(tokenHash, now()));
export const deleteSession = (tokenHash) => q('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
export const listTrays = () => q('SELECT id, designation, created_at FROM trays ORDER BY id DESC').all().map(plain);
export const getTray = (id) =>
	plain(q('SELECT t.*, p.name AS created_by_name FROM trays t JOIN people p ON p.id = t.created_by WHERE t.id = ?').get(id));

/** Returns the new tray id, or null if the designation already exists. */
export function addTray(designation, personId, email, rev) {
	const key = designation.toUpperCase();
	if (q('SELECT 1 FROM trays WHERE designation_key = ?').get(key)) return null;
	const r = q('INSERT INTO trays (designation, designation_key, checklist_rev, created_by, email, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
		designation, key, rev, personId, email, now()
	);
	return Number(r.lastInsertRowid);
}

export const trayEvents = (trayId) =>
	q('SELECT e.*, p.name AS person_name FROM events e JOIN people p ON p.id = e.person_id WHERE e.tray_id = ? ORDER BY e.id')
		.all(trayId)
		.map((r) => ({ ...r, payload: JSON.parse(r.payload) }));

export function addEvent(trayId, personId, email, { kind, key, payload }) {
	q('INSERT INTO events (tray_id, person_id, email, at, kind, key, payload) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
		trayId, personId, email, now(), kind, key, JSON.stringify(payload)
	);
}
