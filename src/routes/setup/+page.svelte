<script>
	import { enhance } from '$app/forms';
	let { data } = $props();
</script>

<svelte:head><title>Set up · BTL Checklists</title></svelte:head>

<section class="card">
	<h1>Set up this server</h1>
	{#if data.noRoot}
		<p>
			No root user is defined yet (new server or new database). You will become the <strong>root user</strong>:
			you can see every user’s details, change these contact details later and make other people root
			from the <em>Users &amp; contact</em> page.
		</p>
	{:else}
		<p>The contact details shown on every page are missing on this server. Please enter them.</p>
	{/if}
	<p class="muted small">Stored only in this server’s database, never in git. Shown at the bottom of every page so shifters and students know whom to call.</p>
	<form method="post" use:enhance class="stack">
		<label>Contact name <input name="name" required minlength="2" maxlength="60" value={data.me?.name ?? ''} autocomplete="name" /></label>
		<label>Phone (required) <input name="phone" type="tel" required maxlength="30" placeholder="+41 22 767 1234 or 71234" autocomplete="tel" /></label>
		<label>Email (optional) <input name="email" type="email" maxlength="120" autocomplete="email" /></label>
		<button>{data.noRoot ? 'Save and become root' : 'Save contact'}</button>
	</form>
</section>
