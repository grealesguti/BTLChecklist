<script>
	import { enhance } from '$app/forms';
	import { CHECKLISTS } from '#lib/checklists/index.js';
	import { shrinkPhotos } from '#lib/shrink.js';

	let { data } = $props();
	let checklist = $state('');
	let type = $state('');
	let busy = $state(false);
	let known = $derived(checklist ? CHECKLISTS[checklist].knownIssues : []);
	let hint = $derived(known.find((k) => k.type === type)?.hint);
	const t = (iso) => iso.slice(0, 16).replace('T', ' ');
	const shrink = shrinkPhotos((b) => (busy = b));
</script>

<svelte:head><title>Issues found later · BTL Checklists</title></svelte:head>

<nav class="tabs" aria-label="Checklists">
	{#each Object.values(CHECKLISTS) as c (c.id)}<a href="/?c={c.id}">{c.title}</a>{/each}
	<a href="/issues" class="active" aria-current="page">⚠ Issues found later</a>
</nav>

<section class="card">
	<h1>Log a problem found later</h1>
	<p class="muted small">
		For problems noticed after a process was finished (e.g. at the next process, in testing, at insertion).
		While doing a checklist, use the step’s <strong>Fail</strong> instead.
	</p>
	<form method="post" action="?/add" enctype="multipart/form-data" use:enhance={shrink} class="stack">
		<label>Tray <input name="designation" required maxlength="40" list="designations" autocomplete="off" value={data.tray ?? ''} /></label>
		<datalist id="designations">{#each data.designations as d (d)}<option value={d}></option>{/each}</datalist>
		<label>Process where the problem comes from
			<select name="checklist" required bind:value={checklist}>
				<option value="" disabled>Choose…</option>
				{#each Object.values(CHECKLISTS) as c (c.id)}<option value={c.id}>{c.title}</option>{/each}
			</select>
		</label>
		{#if checklist}
			<label>Kind of problem
				<select name="type" required bind:value={type}>
					<option value="" disabled>Choose…</option>
					{#each known as k (k.type)}<option value={k.type}>{k.type}</option>{/each}
				</select>
			</label>
			{#if hint}<p class="note small">💡 {hint}</p>{/if}
		{/if}
		<textarea name="description" required maxlength="1000" rows="3" placeholder="What exactly? Which clamp (1A/1B/2A/2B), side, how big, how it was found"></textarea>
		<label>Photos (optional, from the camera) <input type="file" name="photo" accept="image/*" multiple /></label>
		<button disabled={busy}>{busy ? 'Saving…' : 'Log the problem'}</button>
	</form>
</section>

<section class="card">
	<h2>
		{data.tray ? `Issues of tray ${data.tray}` : 'All issues'}
		{#if data.tray}<a class="small" href="/issues">show all</a>{/if}
	</h2>
	{#each data.issues as i (i.id)}
		<div class="exception" class:open={i.status === 'Open'}>
			<p>
				<strong><a href="/issues?tray={encodeURIComponent(i.designation)}">Tray {i.designation}</a> · {i.title}</strong>
				<span class="badge" class:ok={i.status === 'Fixed'} class:bad={i.status === 'Open' || i.status === 'Not fixable'} class:hold={i.status === 'Action decided'}>{i.status}</span><br />
				<strong>{i.type}</strong><br />
				{i.description}<br />
				<span class="meta">#{i.id} · {i.person_name} · {t(i.at)} UTC</span>
			</p>
			{#if i.photos.length}
				<div class="photos">{#each i.photos as f (f)}<a href="/photo/{f}" target="_blank" rel="noopener"><img src="/photo/{f}" alt="Issue photo" loading="lazy" /></a>{/each}</div>
			{/if}
			{#each i.updates as u (u.id)}
				<p class="small">→ <strong>{u.status}</strong>: {u.action} <span class="meta">{u.person_name} · {t(u.at)} UTC</span></p>
				{#if u.photos.length}
					<div class="photos">{#each u.photos as f (f)}<a href="/photo/{f}" target="_blank" rel="noopener"><img src="/photo/{f}" alt="Update photo" loading="lazy" /></a>{/each}</div>
				{/if}
			{/each}
			<details>
				<summary class="small">Add action / update</summary>
				<form method="post" action="?/update" enctype="multipart/form-data" use:enhance={shrink} class="stack">
					<input type="hidden" name="issue" value={i.id} />
					<select name="status" required>{#each data.statuses as s (s)}<option selected={s === i.status}>{s}</option>{/each}</select>
					<textarea name="action" required maxlength="1000" rows="2" placeholder="Action decided / done, result"></textarea>
					<input type="file" name="photo" accept="image/*" multiple aria-label="Photos (optional)" />
					<button disabled={busy}>Save update</button>
				</form>
			</details>
		</div>
	{:else}
		<p class="muted">No issues logged{data.tray ? ' for this tray' : ''}.</p>
	{/each}
</section>
