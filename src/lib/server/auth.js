import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

/** scrypt with a random salt, stored as "scrypt$salt$hash" (base64). */
export function hashPassword(password) {
	const salt = randomBytes(16);
	return `scrypt$${salt.toString('base64')}$${scryptSync(password, salt, 64).toString('base64')}`;
}

// Unknown usernames are checked against this, so they take as long as real ones.
const DUMMY = hashPassword('not-a-real-password');

export function checkPassword(password, stored) {
	const [, salt, hash] = (stored || DUMMY).split('$');
	const want = Buffer.from(hash, 'base64');
	const ok = timingSafeEqual(scryptSync(String(password ?? ''), Buffer.from(salt, 'base64'), want.length), want);
	return ok && !!stored;
}

export const newToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
export const SESSION_MS = 12 * 60 * 60 * 1000;
