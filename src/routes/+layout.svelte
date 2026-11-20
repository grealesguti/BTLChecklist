<script>
	import '../app.css';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { EMERGENCY } from '#lib/checklists/common.js';

	let { data, children } = $props();
	let adding = $state(false); // add a name without login

	// Stay on the current page on errors; the server redirects back on success.
	const stay = () => ({ update }) => update({ navigate: false });
</script>

<header class="topbar">
	<a href="/" class="brand">BTL Checklists</a>
	{#if data.me}
		<div class="who">
			{#if adding}
				<form method="post" action="/?/addPersonNoLogin" use:enhance={stay} class="inline">
					<input type="hidden" name="back" value={page.url.pathname} />
					<input name="name" placeholder="First Last" required minlength="2" maxlength="60"
						pattern={"[\\p{L}][\\p{L}\\p{M} .'’\\-]{1,59}"} title="Letters, spaces and . ' - only (2–60)" />
					<input name="role" placeholder="Role (e.g. technician)" required maxlength="40" />
					<button>Add (no login)</button>
					<button type="button" class="ghost" onclick={() => (adding = false)}>Cancel</button>
				</form>
			{:else}
				<form method="post" action="/login?/logout" use:enhance class="inline">
					<span>Logged in as <strong>{data.me.name}</strong></span>
					{#if data.root}<a href="/users" class="small">Users &amp; contact (root)</a>{/if}
					<a href="/issues" class="small">Issues</a>
					<button type="button" class="ghost" onclick={() => (adding = true)}>+ Add person</button>
					<button class="ghost">Log out</button>
				</form>
			{/if}
		</div>
	{/if}
</header>

{#if page.form?.error}
	<p class="toast" role="alert">{page.form.error}</p>
{/if}

<main>
	{@render children()}
</main>

<footer class="contact">
	{#if data.contact}
		<strong>Questions or problems?</strong> Contact {data.contact.name}:
		<a href="tel:{data.contact.phone.replace(/[^+0-9]/g, '')}">{data.contact.phone}</a>{#if data.contact.email}
			· <a href="mailto:{data.contact.email}">{data.contact.email}</a>{/if}.
	{/if}
	<strong>{EMERGENCY}</strong>
	{#if data.me}<span class="muted"> · session {data.email}</span>{/if}
</footer>
