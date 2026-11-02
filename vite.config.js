import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import { defineConfig } from 'vite';

// Vite injects component styles as inline <style> tags while developing.
const dev = process.argv.includes('dev');

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter(),
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': dev ? ['self', 'unsafe-inline'] : ['self'],
					'img-src': ['self', 'data:'],
					'connect-src': ['self'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'form-action': ['self'],
					'frame-ancestors': ['none']
				}
			}
		})
	]
});
