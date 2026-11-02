import { createRemoteJWKSet, jwtVerify } from 'jose';

const team = process.env.CF_ACCESS_TEAM_DOMAIN; // e.g. myteam.cloudflareaccess.com
const aud = process.env.CF_ACCESS_AUD; // Application Audience (AUD) tag
const jwks = team && createRemoteJWKSet(new URL(`https://${team}/cdn-cgi/access/certs`));

/**
 * Verified email of the Cloudflare Access user, or null. Never trusts the plain
 * email header: the signed JWT is checked against Cloudflare's public keys.
 * Without Access configured, only the dev server gets a placeholder identity.
 */
export async function accessEmail(headers, dev) {
	if (!team || !aud) return dev ? 'dev@localhost' : null;
	const token = headers.get('cf-access-jwt-assertion');
	if (!token) return null;
	try {
		const { payload } = await jwtVerify(token, jwks, { issuer: `https://${team}`, audience: aud });
		const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
		return email.endsWith('@cern.ch') ? email : null;
	} catch {
		return null;
	}
}
