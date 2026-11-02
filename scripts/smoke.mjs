// End-to-end smoke test against a running dev server: `npm run dev`, then
// `node test/smoke.mjs [http://localhost:5173]`. Creates a throwaway tray.
import assert from 'node:assert/strict';

const BASE = process.argv[2] ?? 'http://localhost:5173';
let cookie = '';

async function action(path, fields) {
	const res = await fetch(BASE + path, {
		method: 'POST',
		headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded', origin: BASE, cookie },
		body: new URLSearchParams(fields),
		redirect: 'manual'
	});
	const set = res.headers.get('set-cookie');
	if (set) cookie = set.split(';')[0];
	return res.json();
}
const get = (path) => fetch(BASE + path, { headers: { cookie } });

const home = await get('/');
assert.equal(home.status, 200);
assert.match(home.headers.get('content-security-policy'), /script-src 'self'/);

let r = await action('/?/registerPerson', { name: '<script>alert(1)</script>', back: '/' });
assert.equal(r.type, 'failure', 'markup in names is rejected');

// Unique per run: a name can only be registered with a login once.
const stamp = Date.now().toString(36);
const name = 'Ada ' + stamp.replace(/\d/g, (d) => 'abcdefghij'[d]);
const user = { name, role: 'Technician', username: 'smoke' + stamp, password: 'correct horse', password2: 'correct horse' };

r = await action('/?/registerPerson', { ...user, role: '', back: '/' });
assert.equal(r.type, 'failure', 'role is required at registration');
r = await action('/?/registerPerson', { ...user, password2: 'different', back: '/' });
assert.equal(r.type, 'failure', 'passwords must match');

r = await action('/?/registerPerson', { ...user, back: '//evil.com' });
assert.equal(r.type, 'redirect');
assert.equal(r.location, '/', 'open redirect blocked');

r = await action('/?/registerPerson', { ...user, username: 'other' + stamp, back: '/' });
assert.equal(r.type, 'failure', 'a name with a login cannot be registered again');

// A logged-in user adds a name without a login; that person sets a password later.
const helper = 'Bob ' + stamp.replace(/\d/g, (d) => 'abcdefghij'[d]);
r = await action('/?/addPersonNoLogin', { name: helper, role: 'Technician', back: '/' });
assert.equal(r.type, 'redirect');
r = await action('/?/addPersonNoLogin', { name: helper, role: 'Technician', back: '/' });
assert.equal(r.type, 'failure', 'names are unique');

r = await action('/?/logout', { back: '/' });
assert.equal(r.type, 'redirect');
r = await action('/?/addPersonNoLogin', { name: 'Eve Outsider', role: 'X', back: '/' });
assert.equal(r.type, 'failure', 'adding names needs a login');
r = await action('/?/login', { username: 'bob' + stamp, password: 'whatever pw', back: '/' });
assert.equal(r.type, 'failure', 'a name without a password cannot log in');
r = await action('/?/registerPerson', { name: helper, username: 'bob' + stamp, password: 'bobs secret', password2: 'bobs secret', back: '/' });
assert.equal(r.type, 'redirect', 'the listed name sets its password later (role kept)');
r = await action('/?/logout', { back: '/' });
r = await action('/?/createTray', { designation: 'SMOKE-OUT-' + stamp });
assert.equal(r.type, 'failure', 'logged-out users cannot write');
r = await action('/?/login', { username: user.username, password: 'wrong password', back: '/' });
assert.equal(r.type, 'failure', 'wrong password refused');
r = await action('/?/login', { username: user.username, password: user.password, back: '/' });
assert.equal(r.type, 'redirect', 'correct password logs in');

r = await action('/?/createTray', { designation: 'SMOKE-' + Date.now() });
assert.equal(r.type, 'redirect');
const tray = r.location;

r = await action(tray + '?/step', { step: '01', result: 'P' });
assert.equal(r.type, 'failure', 'step 01 needs the commissioning tests ticked first');

r = await action(tray + '?/step', { step: '19', result: 'P' });
assert.equal(r.type, 'failure', 'step 19 needs both scale readings first');

r = await action(tray + '?/field', { key: 'commTest1', value: 'yes' });
assert.equal(r.type, 'failure', 'a tick only accepts Passed');
for (const key of ['commTest1', 'commTest2', 'commTest3', 'loopPressureTest', 'loopLeakTest']) {
	r = await action(tray + '?/field', { key, value: 'Passed' });
	assert.equal(r.type, 'success');
}
r = await action(tray + '?/step', { step: '01', result: 'P' });
assert.equal(r.type, 'success');

r = await action(tray + '?/step', { step: '01', result: 'F', comment: 'Pigtail scratched' });
assert.equal(r.type, 'failure', 'revision without reason is refused');
r = await action(tray + '?/step', { step: '01', result: 'F', comment: 'Pigtail scratched', reason: 'Re-inspected' });
assert.equal(r.type, 'success');

await action(tray + '?/field', { key: 'cmsTray', value: '20' });
await action(tray + '?/field', { key: 'foamLayers', value: '1' });
r = await action(tray + '?/step', { step: '06a', result: 'P' });
assert.equal(r.type, 'failure', '1 foam layer in tray 20 raises the alarm');
assert.match(await (await get(tray)).text(), /ALARM: only 1 foam layer/);

const me = (await (await get(tray)).text()).match(/<option value="(\d+)" selected/)?.[1];
r = await action(tray + '?/involve', { person: me });
assert.equal(r.type, 'success');
r = await action(tray + '?/involve', { person: me, active: 'no', reason: 'Left' });
assert.equal(r.type, 'failure', 'only the reviewer can remove people');

const xss = '<img src=x onerror=alert(1)>';
r = await action(tray + '?/field', { key: 'bacTray', value: xss });
assert.equal(r.type, 'success');
r = await action(tray + '?/field', { key: 'workDates', value: '2026-02-30' });
assert.equal(r.type, 'failure', 'impossible dates are rejected');
r = await action(tray + '?/field', { key: 'workDates', value: '2026-10-19' });
assert.equal(r.type, 'success');
r = await action(tray + '?/field', { key: 'loopRevision', value: '\\input{/etc/passwd} =HYPERLINK("x")' });
assert.equal(r.type, 'success');

const res = await get(tray);
assert.equal(res.status, 200);
const page = await res.text();
assert.ok(!page.includes(xss), 'user text is escaped in HTML');
assert.ok(page.includes('&lt;img src=x'), 'escaped text is shown');
for (const p of ['/history', '/record']) assert.equal((await get(tray + p)).status, 200, p);

const csv = await (await get(tray + '/log.csv')).text();
assert.match(csv, /"superseded"/);
assert.match(csv, /"Re-inspected"/);
assert.match(csv, /"Exception \(step 01\)"/, 'Fail opens an exception');

const tex = await (await get(tray + '/record.tex')).text();
assert.ok(!tex.includes('\\input{/etc/passwd}'), 'no LaTeX injection');
assert.ok(tex.includes('\\textbackslash{}input\\{/etc/passwd\\}'));
assert.match(tex, /rev\.~2/);

assert.equal((await get('/tray/999999')).status, 404);
console.log('smoke ok:', BASE + tray);
