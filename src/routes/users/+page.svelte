<script>
	import { enhance } from '$app/forms';
	let { data } = $props();
	const t = (iso) => (iso ? iso.slice(0, 16).replace('T', ' ') : '—');
</script>

<svelte:head><title>Users · BTL Checklists</title></svelte:head>

<section class="card">
	<h1>Contact shown on every page</h1>
	<form method="post" action="?/contact" use:enhance class="stack">
		<label>Name <input name="name" required minlength="2" maxlength="60" value={data.contacts[0]?.name ?? ''} /></label>
		<label>Phone <input name="phone" type="tel" required maxlength="30" value={data.contacts[0]?.phone ?? ''} /></label>
		<label>Email (optional) <input name="email" type="email" maxlength="120" value={data.contacts[0]?.email ?? ''} /></label>
		<button>Save contact</button>
	</form>
	{#if data.contacts.length}
		<details>
			<summary class="small">History ({data.contacts.length})</summary>
			<ul class="plain small">
				{#each data.contacts as c (c.id)}<li>{t(c.at)} — {c.name}, {c.phone} {c.email} <span class="muted">(set by {c.set_by_name})</span></li>{/each}
			</ul>
		</details>
	{/if}
</section>

<section class="card">
	<h2>Root users</h2>
	<p class="small muted">Root users see this page. Granting is permanent and logged (also possible with ROOT_USERS in the server .env).</p>
	<form method="post" action="?/grantRoot" use:enhance class="inline">
		<select name="person" required>
			<option value="" disabled selected>Make root…</option>
			{#each data.people.filter((p) => p.has_login && !p.root) as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
		</select>
		<button>Grant root</button>
	</form>
</section>

<section class="card">
	<h1>Users</h1>
	<p class="muted small">Root view (read-only). Everything stored about each person; passwords are only kept as salted hashes and never shown.</p>
	<div class="table-wrap">
		<table class="log">
			<thead>
				<tr><th>Name</th><th>Role</th><th>Username</th><th>Login</th><th>Registered (UTC)</th><th>Registered from</th><th>Entries</th><th>Last entry (UTC)</th><th>Open sessions</th><th>Session identities used</th></tr>
			</thead>
			<tbody>
				{#each data.people as p (p.id)}
					<tr class:superseded={!p.has_login}>
						<td><a href="?id={p.id}">{p.name}</a>{#if p.root} <span class="badge">root</span>{/if}</td>
						<td>{p.role}</td>
						<td>{p.username ?? '—'}</td>
						<td>{p.has_login ? 'yes' : 'no (name only)'}</td>
						<td class="nowrap">{t(p.created_at)}</td>
						<td class="small">{p.created_by_email}</td>
						<td>{p.entries}</td>
						<td class="nowrap">{t(p.last_entry)}</td>
						<td>{p.sessions}</td>
						<td class="small">{p.emails?.replaceAll(',', ', ') ?? ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

{#if data.person}
	<section class="card">
		<h2>Entries by {data.person.name} <span class="muted small">(newest first, last 500)</span></h2>
		<div class="table-wrap">
			<table class="log">
				<thead><tr><th>#</th><th>Time (UTC)</th><th>Checklist</th><th>Record</th><th>Entry</th><th>Session identity</th></tr></thead>
				<tbody>
					{#each data.entries as e (e.id)}
						<tr>
							<td>{e.id}</td>
							<td class="nowrap">{t(e.at)}</td>
							<td>{e.checklistTitle}</td>
							<td><a href="/tray/{e.tray_id}/history">{e.designation}</a></td>
							<td><strong>{e.d.item}</strong>: {e.d.value}{#if e.d.note}<br /><span class="small">{e.d.note}</span>{/if}</td>
							<td class="small">{e.email}</td>
						</tr>
					{:else}
						<tr><td colspan="6" class="muted">No entries.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{/if}
