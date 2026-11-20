import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personName, text, fieldValue, safeBack, Invalid } from '#lib/server/validate.js';
import { toCsv, texEscape } from '#lib/server/export.js';
import { deriveState } from '#lib/server/state.js';
import { rollerOrientation, foamAlarm } from '#lib/checklists/tray/checklist.js';
import { CHECKLISTS, isChecklist, CHAIN } from '#lib/checklists/index.js';
import { stepNeeds, readyAt, COMPLETION_FIELDS, imageRef } from '#lib/checklists/common.js';
import { contact } from '#lib/server/validate.js';
import { hashPassword, checkPassword } from '#lib/server/auth.js';
import { username, password, expired } from '#lib/server/validate.js';
import { existsSync } from 'node:fs';
import { checkPhoto, PHOTO_NAME } from '#lib/server/photos.js';

const FIELDS = CHECKLISTS.tray.FIELDS;
const image = (id, entry) => existsSync(new URL(`../src/lib/checklists/${imageRef(entry, id).path}`, import.meta.url));

// Catches typos in checklist definitions (a missing field, image or step) before they reach the site.
test('checklist definitions are consistent', () => {
	for (const cl of Object.values(CHECKLISTS)) {
		const ns = cl.STEPS.map((st) => st.n);
		assert.equal(new Set(ns).size, ns.length, `${cl.id}: duplicate step numbers`);
		const keys = [...cl.HEADER_FIELDS, ...cl.REQUIRED_FOR_COMPLETION, ...COMPLETION_FIELDS, ...cl.STEPS.flatMap(stepNeeds), ...cl.SECTIONS.flatMap((s) => s.fields ?? [])];
		for (const k of keys) assert.ok(cl.FIELDS[k], `${cl.id}: unknown field ${k}`);
		for (const st of cl.STEPS) {
			if (st.wait) assert.ok(cl.STEP_BY_N[st.wait.after], `${cl.id} ${st.n}: wait.after ${st.wait.after}`);
			for (const f of st.images ?? []) {
				assert.ok(image(cl.id, f), `${cl.id} ${st.n}: missing image ${JSON.stringify(f)}`);
				for (const [x, y, label] of imageRef(f, cl.id).marks) assert.ok(x >= 0 && x <= 100 && y >= 0 && y <= 100 && label, `${cl.id} ${st.n}: bad marker`);
			}
			if (st.previous) assert.ok(cl.after, `${cl.id} ${st.n}: previous without an earlier process`);
		}
		for (const k of cl.knownIssues) assert.ok(k.type, `${cl.id}: known issue without type`);
		for (const d of cl.derived) {
			assert.ok(d.at === 'header' || cl.STEP_BY_N[d.at], `${cl.id}: derived at ${d.at}`);
			if (d.image) assert.ok(image(cl.id, d.image), `${cl.id}: missing image ${d.image}`);
		}
		for (const t of cl.refTables) assert.ok(cl.SECTIONS[t.section], `${cl.id}: ref table section ${t.section}`);
		if (cl.after) assert.ok(CHECKLISTS[cl.after], `${cl.id}: after ${cl.after}`);
	}
	assert.equal(isChecklist('__proto__'), false);
	assert.equal(isChecklist('constructor'), false);
	assert.equal(isChecklist('sensor'), true);
	assert.deepEqual(CHAIN, ['sensor', 'preheater', 'pipeclampandpreheaterassembly', 'tray'], 'insertion is last');
	assert.deepEqual(CHECKLISTS.tray.prior, ['sensor', 'preheater', 'pipeclampandpreheaterassembly']);
	assert.equal(CHECKLISTS.sensor.after, null);
	assert.equal(imageRef('TOAVOID_glue_x.jpg', 'sensor').avoid, true);
	assert.equal(imageRef('tray/A.png', 'sensor').path, 'tray/images/A.png');
});

test('contact details: phone required and plain', () => {
	const form = (o) => ({ get: (k) => o[k] ?? null });
	assert.deepEqual(contact(form({ name: 'Ada Lovelace', phone: '+41 22 767 1234' })), { name: 'Ada Lovelace', phone: '+41 22 767 1234', email: '' });
	for (const phone of ['', 'call me', '<b>1</b>', '1']) assert.throws(() => contact(form({ name: 'Ada Lovelace', phone })), Invalid, phone);
	assert.throws(() => contact(form({ name: 'Ada Lovelace', phone: '71234', email: 'x"@y.ch' })), Invalid);
});

test('curing: step may pass only hours after the step it waits for', () => {
	const st = CHECKLISTS.sensor.STEPS.find((s) => s.wait);
	const at = (result) => ({ [st.wait.after]: { at: '2026-11-19T10:00:00Z', payload: { result } } });
	assert.equal(st.wait.hours, 24);
	assert.equal(readyAt(st, {}), null, 'cure not started');
	assert.equal(readyAt(st, at('F')), null, 'failed step does not start the cure');
	assert.equal(readyAt(st, at('P')), Date.parse('2026-11-20T10:00:00Z'));
});

test('human-error guards: PT1000 range, expiry, gluing in order', () => {
	const alarm = CHECKLISTS.sensor.STEP_BY_N['04'].alarm;
	const f = (v) => ({ ptBefore1B: { payload: { value: v } } });
	assert.equal(alarm({}), null, 'nothing measured yet');
	for (const ok of [1000, 1078, 1200]) assert.equal(alarm(f(ok)), null, String(ok));
	for (const bad of [0, 999, 1201, 999999]) assert.match(alarm(f(bad)), /clamp 1B out of range/, String(bad));
	const res = CHECKLISTS.preheater.STEP_BY_N['06'].alarm;
	assert.equal(res({ resBefore2A: { payload: { value: 331 } } }), null);
	assert.match(res({ resBefore2A: { payload: { value: 3300 } } }), /Resistor of clamp 2A/);
	const now = Date.parse('2026-11-19T12:00:00Z');
	assert.equal(expired('2026-11-18', now), true);
	assert.equal(expired('2026-11-19', now), false, 'still usable on the expiry day');
	assert.throws(() => fieldValue(CHECKLISTS.sensor.FIELDS.glueExpiry, '2020-01-01'), Invalid);
	assert.equal(CHECKLISTS.sensor.strictOrder && CHECKLISTS.preheater.strictOrder, true);
	assert.ok(!CHECKLISTS.tray.strictOrder, 'tray steps stay in any order');
});

test('photos: type from content, automatic safe names', async () => {
	const jpeg = new File([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], 'x.png');
	const p = await checkPhoto(jpeg, 'sensor_TRAY 7/../x_step08', new Date('2026-11-19T10:20:30Z'));
	assert.match(p.file, /^sensor_TRAY-7-x_step08_20261119-102030_[0-9a-f]{12}\.jpg$/, 'named automatically, extension from the bytes');
	assert.ok(PHOTO_NAME.test(p.file));
	assert.ok(PHOTO_NAME.test('0'.repeat(64) + '.jpg'), 'older photos still served');
	await assert.rejects(checkPhoto(new File(['<svg onload=alert(1)>'], 'a.jpg')), Invalid, 'svg/html refused');
	await assert.rejects(checkPhoto(new File([], 'a.jpg')), Invalid, 'empty refused');
	await assert.rejects(checkPhoto('not a file'), Invalid);
	for (const bad of ['../checklist.db', '.hidden.jpg', 'a..jpg', 'a b.jpg', '0'.repeat(64) + '.svg', '0'.repeat(64) + '.jpg/../x']) assert.equal(PHOTO_NAME.test(bad), false, bad);
});

test('passwords: salted hash, checked exactly', () => {
	const h = hashPassword('correct horse');
	assert.notEqual(h, hashPassword('correct horse'), 'random salt');
	assert.ok(!h.includes('correct horse'));
	assert.equal(checkPassword('correct horse', h), true);
	for (const bad of ['correct horse ', 'Correct horse', '', undefined]) assert.equal(checkPassword(bad, h), false, String(bad));
	assert.equal(checkPassword('anything', undefined), false, 'unknown user');
	assert.equal(checkPassword('anything', null), false, 'name without a login yet');
});

test('logins: username and password rules', () => {
	assert.equal(username('  G.Reales '), 'g.reales');
	for (const bad of ['ab', 'a b c', 'x'.repeat(33), '<b>', '']) assert.throws(() => username(bad), Invalid, bad);
	assert.equal(password('  spaces kept  '), '  spaces kept  ');
	for (const bad of ['short', 'x'.repeat(201), undefined]) assert.throws(() => password(bad), Invalid, String(bad));
});

test('roller orientation follows the BTST table', () => {
	const plus = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];
	for (const side of ['+Z', '-Z'])
		for (let t = 0; t <= 35; t++) assert.equal(rollerOrientation(side, t), plus.includes(t) ? '+X' : '-X', `${side} ${t}`);
	assert.equal(rollerOrientation(undefined, 5), null);
	assert.equal(rollerOrientation('+Z', undefined), null);
});

test('foam alarm: 1 layer in CMS trays 18–35', () => {
	const f = (layers, tray) => ({ foamLayers: { payload: { value: layers } }, cmsTray: { payload: { value: tray } } });
	for (let t = 0; t <= 35; t++) {
		assert.equal(foamAlarm(f('1', t)), t >= 18, `1 layer, tray ${t}`);
		assert.equal(foamAlarm(f('2', t)), false, `2 layers, tray ${t}`);
	}
	assert.equal(!!foamAlarm({ foamLayers: { payload: { value: '1' } } }), false, 'no tray yet');
});

test('scaffolding: only the two allowed signers', () => {
	const people = { 1: { id: 1, name: 'Guillermo Reales' }, 2: { id: 2, name: 'guntis pikurs' }, 3: { id: 3, name: 'Ada Lovelace' } };
	const find = (id) => people[id];
	assert.equal(fieldValue(FIELDS.scaffoldingSignedBy, '1', find).value, 1);
	assert.equal(fieldValue(FIELDS.scaffoldingSignedBy, '2', find).value, 2);
	assert.throws(() => fieldValue(FIELDS.scaffoldingSignedBy, '3', find), Invalid);
	assert.equal(fieldValue(FIELDS.collisionEnd1, '3', find).value, 3, 'other person fields unrestricted');
});

test('dates: real calendar dates only', () => {
	assert.deepEqual(fieldValue(FIELDS.workDates, '2026-10-19'), { value: '2026-10-19' });
	for (const bad of ['2026-02-30', '2026-13-01', '19/10/2026', 'today'])
		assert.throws(() => fieldValue(FIELDS.workDates, bad), Invalid, bad);
});

test('names: allow-list only', () => {
	assert.equal(personName('  José   María  O’Neil-Smith '), 'José María O’Neil-Smith');
	for (const bad of ['<script>', 'a', 'Bob"', 'x'.repeat(61), '=cmd', 'Ann & Bo', '1337'])
		assert.throws(() => personName(bad), Invalid, bad);
	assert.equal(personName('Eve\u202Elyn'), 'Evelyn'); // bidi override stripped
});

test('text: strips controls, enforces length', () => {
	assert.equal(text('a\u0000b\u200Bc', 10), 'abc');
	assert.throws(() => text('x'.repeat(11), 10), Invalid);
	assert.throws(() => text({}, 10), Invalid);
});

test('fields: numbers, urls, empty', () => {
	assert.deepEqual(fieldValue({ label: 'kg', type: 'num', min: 0, max: 1000 }, '12,5'), { value: 12.5 });
	assert.throws(() => fieldValue({ label: 'kg', type: 'num', min: 0, max: 1000 }, '1e3'), Invalid);
	assert.throws(() => fieldValue({ label: 'tray', type: 'int', min: 0, max: 35 }, '36'), Invalid);
	assert.throws(() => fieldValue({ label: 'link', type: 'url' }, 'javascript:alert(1)'), Invalid);
	assert.throws(() => fieldValue({ label: 't', type: 'text' }, '   '), Invalid);
});

test('redirects stay on site', () => {
	assert.equal(safeBack('/tray/3'), '/tray/3');
	for (const bad of ['//evil.com', 'https://evil.com', '/\\evil', null]) assert.equal(safeBack(bad), '/');
});

test('csv: formulas neutralised, quotes escaped', () => {
	assert.equal(toCsv([['=1+1', '-2', '@x', 'a"b']]), '\uFEFF"\'=1+1","\'-2","\'@x","a""b"\r\n');
});

test('tex: no command injection', () => {
	assert.equal(
		texEscape('\\input{x} $ % # _ ~ ^ [y]'),
		'\\textbackslash{}input\\{x\\} \\$ \\% \\# \\_ \\textasciitilde{} \\textasciicircum{} {[}y{]}'
	);
});

test('revisions keep history', () => {
	const ev = (id, key, result) => ({ id, kind: 'step', key, payload: { result }, at: '2026-10-19T10:00:00Z', person_name: 'A' });
	const s = deriveState([ev(1, '01', 'F'), ev(2, '02', 'P'), ev(3, '01', 'P')]);
	assert.equal(s.log.length, 3);
	assert.equal(s.steps['01'].payload.result, 'P');
	assert.equal(s.steps['01'].rev, 2);
	assert.equal(s.steps['01'].supersedes, 1);
	assert.equal(s.log[0].current, false);
});
