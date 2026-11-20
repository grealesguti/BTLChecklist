<script>
	import { enhance } from '$app/forms';
	import { shrinkPhotos } from './shrink.js';
	/**
	 * Photo upload for one step. On a phone, the picker offers the camera directly. Photos are shrunk
	 * in the browser before upload (shrink.js); the server names and stores them.
	 */
	let { step, required = false, count = 0 } = $props();
	let busy = $state(false);
</script>

<details class="photo-upload" open={required && !count}>
	<summary class="small">📷 {required ? 'Photo expected' : 'Add photo'}{count ? ` (${count} uploaded)` : ''}</summary>
	<form method="post" action="?/photo" enctype="multipart/form-data" use:enhance={shrinkPhotos((b) => (busy = b))} class="stack">
		<input type="hidden" name="step" value={step} />
		<input type="file" name="photo" accept="image/*" multiple required aria-label="Take or choose photos" />
		<input name="caption" maxlength="200" placeholder="What does it show? (optional)" />
		<button disabled={busy}>{busy ? 'Uploading…' : 'Upload photo'}</button>
	</form>
</details>
