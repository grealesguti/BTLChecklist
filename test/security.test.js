import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personName, text, fieldValue, safeBack, Invalid } from '#lib/server/validate.js';
import { toCsv, texEscape } from '#lib/server/export.js';
import { deriveState } from '#lib/server/state.js';
import { rollerOrientation, foamAlarm, FIELDS } from '#lib/checklist.js';
import { hashPassword, checkPassword } from '#lib/server/auth.js';
import { username, password } from '#lib/server/validate.js';

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
