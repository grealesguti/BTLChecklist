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
const peek = (path) => fetch(BASE + path, { headers: { cookie }, redirect: 'manual' });

// Login required for everything except /login.
for (const p of ['/', '/issues', '/trays.csv', '/tray/1', '/photo/x.jpg', '/users']) {
	const res = await peek(p);
	assert.equal(res.status, 303, p);
	assert.match(res.headers.get('location'), /^\/login\?back=/, p);
}
const login = await get('/login');
assert.equal(login.status, 200);
assert.match(login.headers.get('content-security-policy'), /script-src 'self'/);
assert.match(await login.text(), /CERN emergency: 74444/, 'emergency number on every page');

let r = await action('/login?/registerPerson', { name: '<script>alert(1)</script>', back: '/' });
assert.equal(r.type, 'failure', 'markup in names is rejected');

// Unique per run: a name can only be registered with a login once.
const stamp = Date.now().toString(36);
const name = 'Ada ' + stamp.replace(/\d/g, (d) => 'abcdefghij'[d]);
const user = { name, role: 'Technician', username: 'smoke' + stamp, password: 'correct horse', password2: 'correct horse' };

r = await action('/login?/registerPerson', { ...user, role: '', back: '/' });
assert.equal(r.type, 'failure', 'role is required at registration');
r = await action('/login?/registerPerson', { ...user, password2: 'different', back: '/' });
assert.equal(r.type, 'failure', 'passwords must match');

r = await action('/login?/registerPerson', { ...user, back: '//evil.com' });
assert.equal(r.type, 'redirect');
assert.equal(r.location, '/', 'open redirect blocked');

// No root yet (fresh database): the first logged-in user is sent to the setup page.
let isRoot = false;
if ((await peek('/')).headers.get('location') === '/setup') {
	r = await action('/setup', { name: name, phone: 'not a phone' });
	assert.equal(r.type, 'failure', 'phone validated');
	r = await action('/setup', { name: name, phone: '+41 22 767 0000', email: '' });
	assert.equal(r.type, 'redirect', 'root + contact created');
	isRoot = true;
}
assert.equal((await peek('/setup')).status, 303, 'setup only once');
assert.match(await (await get('/')).text(), /Questions or problems\?<\/strong> Contact .*\+41 22 767 0000/s, 'contact shown');

r = await action('/login?/registerPerson', { ...user, username: 'other' + stamp, back: '/' });
assert.equal(r.type, 'failure', 'a name with a login cannot be registered again');

// A logged-in user adds a name without a login; that person sets a password later.
const helper = 'Bob ' + stamp.replace(/\d/g, (d) => 'abcdefghij'[d]);
r = await action('/?/addPersonNoLogin', { name: helper, role: 'Technician', back: '/' });
assert.equal(r.type, 'redirect');
r = await action('/?/addPersonNoLogin', { name: helper, role: 'Technician', back: '/' });
assert.equal(r.type, 'failure', 'names are unique');

r = await action('/login?/logout', {});
assert.equal(r.type, 'redirect');
r = await action('/?/addPersonNoLogin', { name: 'Eve Outsider', role: 'X', back: '/' });
assert.match(r.location ?? '', /^\/login\?back=/, 'logged-out writes are sent to the login page');
r = await action('/login?/login', { username: 'bob' + stamp, password: 'whatever pw', back: '/' });
assert.equal(r.type, 'failure', 'a name without a password cannot log in');
r = await action('/login?/registerPerson', { name: helper, username: 'bob' + stamp, password: 'bobs secret', password2: 'bobs secret', back: '/' });
assert.equal(r.type, 'redirect', 'the listed name sets its password later (role kept)');
r = await action('/login?/logout', {});
r = await action('/?/createTray', { checklist: 'tray', designation: 'SMOKE-OUT-' + stamp });
assert.match(r.location ?? '', /^\/login/, 'logged-out users cannot write');
r = await action('/login?/login', { username: user.username, password: 'wrong password', back: '/' });
assert.equal(r.type, 'failure', 'wrong password refused');
r = await action('/login?/login', { username: user.username, password: user.password, back: '/' });
assert.equal(r.type, 'redirect', 'correct password logs in');

r = await action('/?/createTray', { checklist: '__proto__', designation: 'SMOKE-X-' + stamp });
assert.equal(r.type, 'failure', 'unknown checklist refused');
r = await action('/?/createTray', { checklist: 'tray', designation: 'SMOKE-' + Date.now() });
assert.equal(r.type, 'failure', 'insertion without approved earlier processes needs confirmation');
assert.match(JSON.stringify(r), /earlier processes not approved/);
r = await action('/?/createTray', { checklist: 'tray', designation: 'SMOKE-' + Date.now(), confirmPrior: 'yes' });
assert.equal(r.type, 'redirect');
const tray = r.location;
assert.match(await (await get(tray)).text(), /Earlier processes of tray .* are not approved/, 'warning on the record');

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

const me = (await (await get(tray)).text()).match(new RegExp(`<option value="(\\d+)">${name}</option>`))?.[1];
r = await action(tray + '?/involve', { person: me });
assert.equal(r.type, 'success', `involve person ${me}: ${JSON.stringify(r)}`);
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

// Gluing: one tray designation, several checklists in order; each warns while earlier ones are not approved.
const unit = 'SMOKE-U-' + stamp;
r = await action('/?/createTray', { checklist: 'sensor', designation: unit });
assert.equal(r.type, 'redirect', 'first process: no confirmation needed');
const sen = r.location;
r = await action('/?/createTray', { checklist: 'preheater', designation: unit });
assert.equal(r.type, 'failure', 'sensor gluing not Complete: confirmation needed');
r = await action('/?/createTray', { checklist: 'preheater', designation: unit, confirmPrior: 'yes' });
assert.equal(r.type, 'redirect', 'same tray designation in another checklist');
const pre = r.location;
r = await action('/?/createTray', { checklist: 'preheater', designation: unit, confirmPrior: 'yes' });
assert.equal(r.type, 'failure', 'designation unique per checklist');
assert.match(await (await get('/?c=preheater')).text(), /Earlier processes not approved: Sensor gluing/, 'badge on the list');
assert.match(await (await get('/')).text(), new RegExp(`<option value="${unit}">`), 'designation suggested');
for (const n of ['01', '02']) await action(pre + '?/step', { step: n, result: 'P' });
r = await action(pre + '?/step', { step: '03', result: 'P' });
assert.equal(r.type, 'failure', 'preheater step 03 needs the sensor record Complete');

async function upload(path, step, bytes, name) {
	const form = new FormData();
	form.set('step', step);
	form.set('photo', new File([bytes], name));
	const res = await fetch(BASE + path + '?/photo', { method: 'POST', headers: { accept: 'application/json', origin: BASE, cookie }, body: form });
	return res.json();
}
const pass = (step, extra = {}) => action(sen + '?/step', { step, result: 'P', ...extra });
const field = (key, value, extra = {}) => action(sen + '?/field', { key, value, ...extra });
const helperId = (await (await get(sen)).text()).match(new RegExp(`<option value="(\\d+)">${helper}</option>`))?.[1];
assert.ok(helperId, 'second person listed');

r = await pass('03');
assert.equal(r.type, 'failure', 'strict order: 01 first');
assert.match(JSON.stringify(r), /in order/);
assert.equal((await pass('01')).type, 'success');
assert.equal((await pass('02')).type, 'success', 'missing photo does not block');
assert.match(await (await get(sen)).text(), /Passed without the expected photo: step 02/, 'but it is warned');
r = await upload(sen, '02', '<svg onload=alert(1)>', 'evil.jpg');
assert.equal(r.type, 'failure', 'non-image refused');
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(stamp)]);
r = await upload(sen, '02', jpeg, 'foil.jpg');
assert.equal(r.type, 'success');
const page2 = await (await get(sen)).text();
assert.ok(!page2.includes('Passed without the expected photo'), 'warning gone once the photo is there');
const photo = page2.match(/\/photo\/(sensor_SMOKE-U-[\w-]+_step02_\d{8}-\d{6}_[0-9a-f]{12}\.jpg)/)?.[1];
assert.ok(photo, 'photo named automatically and shown on the step');
const img = await get('/photo/' + photo);
assert.equal(img.headers.get('content-type'), 'image/jpeg');
assert.deepEqual(Buffer.from(await img.arrayBuffer()), jpeg, 'stored bytes unchanged');
assert.equal((await get('/photo/..%2Fchecklist.db')).status, 404);
assert.equal((await pass('03')).type, 'success');

// PT1000 measurement: out-of-range value blocks Pass; second check must be someone else.
for (const [k, v] of [['ptBefore1A', '1080'], ['ptBefore1B', '99999'], ['ptBefore2A', '1079.5'], ['ptBefore2B', '1081']])
	assert.equal((await field(k, v)).type, 'success', k);
r = await pass('04', { checker: helperId });
assert.equal(r.type, 'failure', 'open-circuit PT1000 raises the alarm');
assert.match(JSON.stringify(r), /clamp 1B out of range/);
assert.equal((await field('ptBefore1B', '1078', { reason: 'Probe slipped, re-measured' })).type, 'success');
assert.equal((await pass('04')).type, 'failure', 'second check required');
assert.equal((await pass('04', { checker: me })).type, 'failure', 'not by the same person');
assert.equal((await pass('04', { checker: helperId })).type, 'success');
assert.match(await (await get(sen)).text(), new RegExp(`second check: <strong>${helper}`));

assert.equal((await field('glueExpiry', '2020-01-01')).type, 'failure', 'expired glue refused');
assert.equal((await field('glueExpiry', '2099-12-31')).type, 'success');
assert.equal((await field('glueLot', 'LOT-' + stamp)).type, 'success');
assert.equal((await pass('05')).type, 'success');
assert.equal((await pass('06')).type, 'failure', 'sub-step 05b (glue gun check) comes first');
assert.equal((await pass('05b', { checker: helperId })).type, 'success');
for (const n of ['06', '07']) assert.equal((await pass(n)).type, 'success', n);
assert.equal((await pass('08', { checker: helperId })).type, 'success');
assert.equal((await pass('09')).type, 'success');
assert.equal((await pass('10', { checker: helperId })).type, 'success');
for (const n of ['11', '12', '13']) assert.equal((await pass(n)).type, 'success', n);
assert.equal((await pass('14')).type, 'success');
r = await pass('15');
assert.equal(r.type, 'failure', 'cure step refused before 24 h');
assert.match(JSON.stringify(r), /curing/);

// Sign-off: only the assigned reviewer may complete.
assert.equal((await field('reviewer', helperId)).type, 'success');
assert.equal((await field('status', 'Complete')).type, 'failure', 'only the reviewer completes');

// Issues found later: logged by anyone, shown on the tray's records.
const issue = async (fields, photoBytes) => {
	const form = new FormData();
	for (const [k, v] of Object.entries(fields)) form.set(k, v);
	if (photoBytes) form.set('photo', new File([photoBytes], 'x.jpg'));
	const res = await fetch(BASE + '/issues?/add', { method: 'POST', headers: { accept: 'application/json', origin: BASE, cookie }, body: form });
	return res.json();
};
r = await issue({ designation: unit, checklist: 'preheater', type: 'made up', description: 'x' });
assert.equal(r.type, 'failure', 'issue type from the known list');
r = await issue({ designation: unit, checklist: 'preheater', type: 'Broken pin in the jig: resistor slid, holes not aligned with the aluminium clamp', description: 'Clamp 2A, ~0.5 mm' }, jpeg);
assert.equal(r.type, 'success');
assert.match(await (await get('/issues?tray=' + unit)).text(), /Clamp 2A, ~0.5 mm/);
assert.match(await (await get(pre)).text(), /Open issues logged for tray/, 'open issue shown on the record');

assert.equal((await get('/users')).status, isRoot ? 200 : 404, 'users page is root-only');
assert.equal((await get('/?c=pipeclampandpreheaterassembly')).status, 200);
assert.equal((await get('/trays.csv?c=preheater')).status, 200);
console.log('smoke ok:', BASE + tray, isRoot ? '(this run created the root user)' : '');
