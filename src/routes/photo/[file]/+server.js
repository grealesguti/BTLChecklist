import { error } from '@sveltejs/kit';
import { readPhoto } from '#lib/server/photos.js';

export function GET({ params }) {
	const p = readPhoto(params.file);
	if (!p) error(404, 'Photo not found');
	return new Response(p.buf, {
		headers: {
			'Content-Type': p.type,
			// Content-addressed: the bytes behind a name never change.
			'Cache-Control': 'private, max-age=31536000, immutable',
			'Content-Security-Policy': "default-src 'none'"
		}
	});
}
