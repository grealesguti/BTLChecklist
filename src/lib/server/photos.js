import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Invalid } from '#lib/server/validate.js';

// Photos live next to the database (data/uploads/), named automatically:
// <checklist>_<tray>_step<NN>_<UTC time>_<first 12 hex of SHA-256>.<ext> (older ones: <sha256>.<ext>).
// Written once, never overwritten or deleted; only safe characters reach the file name.
const dir = () => join(dirname(process.env.DB_PATH || 'data/checklist.db'), 'uploads');

// Browsers shrink photos to ≤1600 px JPEG (a few hundred kB) before upload; this caps the rest.
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const MAX_PHOTOS = 4; // per upload; keep BODY_SIZE_LIMIT (.env) and nginx client_max_body_size at 20M

// Type from the file's first bytes, not from its name or the browser's claim.
const TYPES = {
	jpg: { type: 'image/jpeg', is: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
	png: { type: 'image/png', is: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
	webp: { type: 'image/webp', is: (b) => b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP' }
};
// Letters, digits, _ - . only, no "..", known extension: nothing can point outside uploads/.
export const PHOTO_NAME = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9_.-]{0,180}\.(jpg|png|webp)$/;
const safe = (s) => s.replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 80);

/** Validates one uploaded File; returns { buf, file, sha256, size } without writing anything. */
export async function checkPhoto(f, prefix = 'photo', now = new Date()) {
	if (!(f instanceof File) || f.size === 0) throw new Invalid('Choose a photo.');
	if (f.size > MAX_PHOTO_BYTES) throw new Invalid(`Photo too large (max ${MAX_PHOTO_BYTES / 1024 / 1024} MB). Upload from the web page: it shrinks photos automatically.`);
	const buf = Buffer.from(await f.arrayBuffer());
	const ext = Object.keys(TYPES).find((k) => TYPES[k].is(buf));
	if (!ext) throw new Invalid('Photos must be JPEG, PNG or WebP (iPhone: Settings → Camera → Formats → Most Compatible).');
	const sha256 = createHash('sha256').update(buf).digest('hex');
	const time = now.toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
	return { buf, file: `${safe(prefix)}_${time}_${sha256.slice(0, 12)}.${ext}`, sha256, size: buf.length };
}

/** Optional photos of a form ('photo' fields): all validated first, then stored. Returns their file names. */
export async function savePhotos(data, prefix) {
	const files = data.getAll('photo').filter((f) => f instanceof File && f.size > 0);
	if (files.length > MAX_PHOTOS) throw new Invalid(`At most ${MAX_PHOTOS} photos per upload.`);
	const checked = [];
	for (const f of files) checked.push(await checkPhoto(f, prefix));
	for (const p of checked) storePhoto(p);
	return checked.map((p) => p.file);
}

export function storePhoto({ buf, file }) {
	mkdirSync(dir(), { recursive: true });
	try {
		writeFileSync(join(dir(), file), buf, { flag: 'wx' }); // wx: never overwrite
	} catch (e) {
		if (e.code !== 'EEXIST') throw e; // same name = same bytes in the same second: nothing to do
	}
}

export function readPhoto(file) {
	if (!PHOTO_NAME.test(file)) return null;
	try {
		return { buf: readFileSync(join(dir(), file)), type: TYPES[file.split('.').at(-1)].type };
	} catch {
		return null;
	}
}
