<script>
	import { enhance } from '$app/forms';
	let { data } = $props();
	let registering = $state(false);
	$effect.pre(() => {
		if (data.firstUser) registering = true;
	});
	// Stay on the page on errors; the server redirects on success.
	const stay = () => ({ update }) => update({ navigate: false });
</script>

<svelte:head><title>Log in · BTL Checklists</title></svelte:head>

<section class="card">
	{#if data.firstUser}
		<h1>Welcome</h1>
		<p>No account exists yet. Register the first account: you will then be asked for the contact details (phone) shown to everyone, and become the root user.</p>
	{:else}
		<h1>Log in</h1>
		<p class="muted small">BTL assembly checklists. Log in to see and record anything. First time here? Register below.</p>
		{#if data.noRoot}
			<p class="note small">
				⚙ This server is not set up yet: no root user. The next person who logs in (or registers) becomes
				root and enters the contact phone shown on every page.
			</p>
		{/if}
	{/if}

	{#if !registering}
		<form method="post" action="?/login" use:enhance={stay} class="stack">
			<input type="hidden" name="back" value={data.back} />
			<input name="username" placeholder="Username" required maxlength="32" autocomplete="username" autocapitalize="none" />
			<input name="password" type="password" placeholder="Password" required maxlength="200" autocomplete="current-password" />
			<button>Log in</button>
		</form>
		<p><button type="button" class="ghost" onclick={() => (registering = true)}>New here? Register / set your password</button></p>
	{:else}
		<form method="post" action="?/registerPerson" use:enhance={stay} class="stack">
			<input type="hidden" name="back" value={data.back} />
			<input name="name" placeholder="First Last" required minlength="2" maxlength="60" autocomplete="name"
				pattern={"[\\p{L}][\\p{L}\\p{M} .'’\\-]{1,59}"} title="Letters, spaces and . ' - only (2–60)" />
			<input name="role" placeholder="Role, e.g. technician, student, shifter (blank if already listed)" maxlength="40" />
			<input name="username" placeholder="Username" required minlength="3" maxlength="32" autocomplete="username" autocapitalize="none"
				pattern="[A-Za-z0-9._\-]{'{3,32}'}" title="3–32 letters, digits, . _ -" />
			<input name="password" type="password" placeholder="Create a password (min. 8)" required minlength="8" maxlength="200" autocomplete="new-password" />
			<input name="password2" type="password" placeholder="Repeat password" required minlength="8" maxlength="200" autocomplete="new-password" />
			<button>Register</button>
		</form>
		{#if !data.firstUser}<p><button type="button" class="ghost" onclick={() => (registering = false)}>I already have an account: log in</button></p>{/if}
	{/if}
</section>
