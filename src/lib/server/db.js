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

-- Root users (besides ROOT_USERS in .env). Granting is logged; nothing is ever removed.
CREATE TABLE IF NOT EXISTS roots (
	person_id INTEGER PRIMARY KEY REFERENCES people(id),
	granted_by INTEGER REFERENCES people(id),
	at TEXT NOT NULL
);
-- Contact shown on every page; the latest row is current, older rows are its history.
CREATE TABLE IF NOT EXISTS contact_history (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	phone TEXT NOT NULL,
	email TEXT NOT NULL,
	set_by INTEGER NOT NULL REFERENCES people(id),
	at TEXT NOT NULL
);
-- Problems found later on processes already performed (any tray, any process; no record needed).
CREATE TABLE IF NOT EXISTS issues (
	id INTEGER PRIMARY KEY,
	designation TEXT NOT NULL,
	designation_key TEXT NOT NULL,
	checklist TEXT NOT NULL,
	type TEXT NOT NULL,
	description TEXT NOT NULL,
	photos TEXT NOT NULL DEFAULT '[]',
	person_id INTEGER NOT NULL REFERENCES people(id),
	email TEXT NOT NULL,
	at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS issue_updates (
	id INTEGER PRIMARY KEY,
	issue_id INTEGER NOT NULL REFERENCES issues(id),
	status TEXT NOT NULL,
	action TEXT NOT NULL,
	photos TEXT NOT NULL DEFAULT '[]',
	person_id INTEGER NOT NULL REFERENCES people(id),
	email TEXT NOT NULL,
	at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS issues_tray ON issues(designation_key);
CREATE TRIGGER IF NOT EXISTS roots_no_change BEFORE UPDATE ON roots BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS roots_no_delete BEFORE DELETE ON roots BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS contact_no_change BEFORE UPDATE ON contact_history BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS contact_no_delete BEFORE DELETE ON contact_history BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS issues_no_change BEFORE UPDATE ON issues BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS issues_no_delete BEFORE DELETE ON issues BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS issue_updates_no_change BEFORE UPDATE ON issue_updates BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS issue_updates_no_delete BEFORE DELETE ON issue_updates BEGIN SELECT RAISE(ABORT, 'append-only'); END;
`;

let db;
function open() {
	const path = process.env.DB_PATH || 'data/checklist.db';
	mkdirSync(dirname(path), { recursive: true });
	const d = new DatabaseSync(path);
	d.exec(SCHEMA);
	// Upgrades of older databases. Additive only: ADD COLUMN / new indexes, never UPDATE or DELETE of
	// recorded rows, so a new version never changes what is already stored.
	const cols = d.prepare('PRAGMA table_info(people)').all().map((c) => c.name);
	if (!cols.includes('role')) d.exec("ALTER TABLE people ADD COLUMN role TEXT NOT NULL DEFAULT ''");
	if (!cols.includes('username')) d.exec('ALTER TABLE people ADD COLUMN username TEXT; ALTER TABLE people ADD COLUMN pass_hash TEXT;');
	d.exec('CREATE UNIQUE INDEX IF NOT EXISTS people_username ON people(username)');
	// Several checklists: records made before this read as 'tray' through the column default.
	if (!d.prepare('PRAGMA table_info(trays)').all().some((c) => c.name === 'checklist'))
		d.exec("ALTER TABLE trays ADD COLUMN checklist TEXT NOT NULL DEFAULT 'tray'");
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
	plain(q('SELECT p.id, p.name, p.role, p.username FROM sessions s JOIN people p ON p.id = s.person_id WHERE s.token_hash = ? AND s.expires_at > ?').get(tokenHash, now()));
export const deleteSession = (tokenHash) => q('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
// "trays" holds the records of every checklist (name kept so existing databases stay as they are).
export const listTrays = (checklist) =>
	q('SELECT id, designation, checklist, created_at FROM trays WHERE checklist = ? ORDER BY id DESC').all(checklist).map(plain);
export const getTray = (id) =>
	plain(q('SELECT t.*, p.name AS created_by_name FROM trays t JOIN people p ON p.id = t.created_by WHERE t.id = ?').get(id));

// designation_key is UNIQUE across all records. Tray keys stay the bare designation (as before);
// other checklists prefix their id, so one unit can have a sensor and a preheater record.
// Designations cannot contain ':', so keys never collide.
const designationKey = (checklist, designation) => (checklist === 'tray' ? '' : checklist + ':') + designation.toUpperCase();

// Every designation used in any checklist: suggested when starting a record, so typos stand out.
export const allDesignations = () => q('SELECT DISTINCT designation FROM trays ORDER BY designation COLLATE NOCASE').all().map((r) => r.designation);

export const findTray = (checklist, designation) =>
	plain(q('SELECT id, designation FROM trays WHERE designation_key = ?').get(designationKey(checklist, designation)));

/** Returns the new record id, or null if the designation already exists for this checklist. */
export function addTray(designation, checklist, personId, email, rev) {
	const key = designationKey(checklist, designation);
	if (q('SELECT 1 FROM trays WHERE designation_key = ?').get(key)) return null;
	const r = q('INSERT INTO trays (designation, designation_key, checklist, checklist_rev, created_by, email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
		designation, key, checklist, rev, personId, email, now()
	);
	return Number(r.lastInsertRowid);
}

// Root users and contact details.
export const anyLogin = () => !!q('SELECT 1 FROM people WHERE pass_hash IS NOT NULL LIMIT 1').get();
export const dbRoot = (personId) => !!q('SELECT 1 FROM roots WHERE person_id = ?').get(personId);
export const anyDbRoot = () => !!q('SELECT 1 FROM roots LIMIT 1').get();
export const addRoot = (personId, grantedBy) => q('INSERT OR IGNORE INTO roots (person_id, granted_by, at) VALUES (?, ?, ?)').run(personId, grantedBy, now());
export const currentContact = () => plain(q('SELECT c.*, p.name AS set_by_name FROM contact_history c JOIN people p ON p.id = c.set_by ORDER BY c.id DESC LIMIT 1').get());
export const contactHistory = () => q('SELECT c.*, p.name AS set_by_name FROM contact_history c JOIN people p ON p.id = c.set_by ORDER BY c.id DESC').all().map(plain);
export const setContact = ({ name, phone, email }, personId) =>
	q('INSERT INTO contact_history (name, phone, email, set_by, at) VALUES (?, ?, ?, ?, ?)').run(name, phone, email, personId, now());

// Issues found later. Status / action are the latest update; every update is kept.
export function addIssue({ designation, checklist, type, description, photos }, personId, email) {
	const r = q('INSERT INTO issues (designation, designation_key, checklist, type, description, photos, person_id, email, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
		designation, designation.toUpperCase(), checklist, type, description, JSON.stringify(photos), personId, email, now()
	);
	return Number(r.lastInsertRowid);
}
export const addIssueUpdate = (issueId, { status, action, photos }, personId, email) =>
	q('INSERT INTO issue_updates (issue_id, status, action, photos, person_id, email, at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(issueId, status, action, JSON.stringify(photos), personId, email, now());
export const getIssue = (id) => plain(q('SELECT id, designation FROM issues WHERE id = ?').get(id));
export function listIssues(designation = null) {
	const issues = q(`SELECT i.*, p.name AS person_name FROM issues i JOIN people p ON p.id = i.person_id
		${designation ? 'WHERE i.designation_key = ?' : ''} ORDER BY i.id DESC LIMIT 500`).all(...(designation ? [designation.toUpperCase()] : []));
	const updates = q('SELECT u.*, p.name AS person_name FROM issue_updates u JOIN people p ON p.id = u.person_id ORDER BY u.id').all();
	return issues.map((i) => {
		const ups = updates.filter((u) => u.issue_id === i.id).map((u) => ({ ...u, photos: JSON.parse(u.photos) }));
		return { ...i, photos: JSON.parse(i.photos), updates: ups, status: ups.at(-1)?.status ?? 'Open' };
	});
}

// Root page: everything known about each person (never the password hash).
export const peopleOverview = () =>
	q(`SELECT p.id, p.name, p.role, p.username, p.pass_hash IS NOT NULL AS has_login, p.created_at, p.created_by_email,
		(SELECT COUNT(*) FROM events e WHERE e.person_id = p.id) AS entries,
		(SELECT MAX(at) FROM events e WHERE e.person_id = p.id) AS last_entry,
		(SELECT GROUP_CONCAT(DISTINCT e.email) FROM events e WHERE e.person_id = p.id) AS emails,
		(SELECT COUNT(*) FROM sessions s WHERE s.person_id = p.id AND s.expires_at > ?) AS sessions
		FROM people p ORDER BY p.name COLLATE NOCASE`).all(now()).map(plain);
export const personEvents = (personId) =>
	q(`SELECT e.*, t.designation, t.checklist FROM events e JOIN trays t ON t.id = e.tray_id
		WHERE e.person_id = ? ORDER BY e.id DESC LIMIT 500`).all(personId).map((r) => ({ ...r, payload: JSON.parse(r.payload) }));

export const trayEvents = (trayId) =>
	q('SELECT e.*, p.name AS person_name FROM events e JOIN people p ON p.id = e.person_id WHERE e.tray_id = ? ORDER BY e.id')
		.all(trayId)
		.map((r) => ({ ...r, payload: JSON.parse(r.payload) }));

export function addEvent(trayId, personId, email, { kind, key, payload }) {
	q('INSERT INTO events (tray_id, person_id, email, at, kind, key, payload) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
		trayId, personId, email, now(), kind, key, JSON.stringify(payload)
	);
}
