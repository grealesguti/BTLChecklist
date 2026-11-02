<script>
	import '../app.css';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';

	let { data, children } = $props();
	let registering = $state(false); // logged out: register / set password
	let adding = $state(false); // logged in: add a name without login

	// Stay on the current page on errors; the server redirects back on success.
	const stay = () => ({ update }) => update({ navigate: false });
</script>

<header class="topbar">
	<a href="/" class="brand">BTL Tray Checklist</a>
	<div class="who">
		{#if data.me && adding}
			<form method="post" action="/?/addPersonNoLogin" use:enhance={stay} class="inline">
				<input type="hidden" name="back" value={page.url.pathname} />
				<input name="name" placeholder="First Last" required minlength="2" maxlength="60"
					pattern={"[\\p{L}][\\p{L}\\p{M} .'’\\-]{1,59}"} title="Letters, spaces and . ' - only (2–60)" />
				<input name="role" placeholder="Role (e.g. technician)" required maxlength="40" />
				<button>Add (no login)</button>
				<button type="button" class="ghost" onclick={() => (adding = false)}>Cancel</button>
			</form>
		{:else if data.me}
			<form method="post" action="/?/logout" use:enhance={stay} class="inline">
				<input type="hidden" name="back" value={page.url.pathname} />
				<span>Logged in as <strong>{data.me.name}</strong></span>
				<button type="button" class="ghost" onclick={() => (adding = true)}>+ Add person</button>
				<button class="ghost">Log out</button>
			</form>
		{:else if registering}
			<form method="post" action="/?/registerPerson" use:enhance={stay} class="inline">
				<input type="hidden" name="back" value={page.url.pathname} />
				<input name="name" placeholder="First Last" required minlength="2" maxlength="60" autocomplete="name"
					pattern={"[\\p{L}][\\p{L}\\p{M} .'’\\-]{1,59}"} title="Letters, spaces and . ' - only (2–60)" />
				<input name="role" placeholder="Role (blank if already listed)" maxlength="40" />
				<input name="username" placeholder="Username" required minlength="3" maxlength="32" autocomplete="username"
					pattern="[A-Za-z0-9._\-]{'{3,32}'}" title="3–32 letters, digits, . _ -" />
				<input name="password" type="password" placeholder="Create a password (min. 8)" required minlength="8" maxlength="200" autocomplete="new-password" />
				<input name="password2" type="password" placeholder="Repeat password" required minlength="8" maxlength="200" autocomplete="new-password" />
				<button>Register</button>
				<button type="button" class="ghost" onclick={() => (registering = false)}>Cancel</button>
			</form>
		{:else}
			<form method="post" action="/?/login" use:enhance={stay} class="inline">
				<input type="hidden" name="back" value={page.url.pathname} />
				<input name="username" placeholder="Username" required maxlength="32" autocomplete="username" />
				<input name="password" type="password" placeholder="Password" required maxlength="200" autocomplete="current-password" />
				<button>Log in</button>
				<button type="button" class="ghost" onclick={() => (registering = true)}>Register / set password</button>
			</form>
		{/if}
		<span class="muted small">{data.email}</span>
	</div>
</header>

{#if page.form?.error}
	<p class="toast" role="alert">{page.form.error}</p>
{/if}

<main>
	{@render children()}
</main>
