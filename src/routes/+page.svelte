<script>
	import { enhance } from '$app/forms';
	import { CHECKLISTS } from '#lib/checklists/index.js';
	let { data, form } = $props();
	let cl = $derived(CHECKLISTS[data.checklist]);
</script>

<svelte:head><title>{cl.title} · BTL Checklists</title></svelte:head>

<nav class="tabs" aria-label="Checklists">
	{#each Object.values(CHECKLISTS) as c (c.id)}
		<a href="/?c={c.id}" class:active={c.id === cl.id} aria-current={c.id === cl.id ? 'page' : undefined}>{c.title}</a>
	{/each}
	<a href="/issues">⚠ Issues found later</a>
</nav>
<p class="muted small">Order for each tray: {Object.values(CHECKLISTS).map((c) => c.title).join(' → ')} (insertion is always last, before commissioning).</p>

<section class="card">
	<h1>{cl.title}</h1>
	<p class="muted small">{cl.REVISION}{#if cl.after} · follows {CHECKLISTS[cl.after].title} (same {cl.unit.toLowerCase()} designation){/if}</p>
	<form method="post" action="?/createTray" use:enhance class="inline">
		<input type="hidden" name="checklist" value={cl.id} />
		<input name="designation" placeholder="{cl.unit} designation" required maxlength="40" list="designations" autocomplete="off"
			pattern={'[A-Za-z0-9][A-Za-z0-9 ._\\-]{0,39}'} title="Letters, digits, space . _ - (max 40)" />
		<!-- Designations already used in any checklist: pick one instead of retyping it. -->
		<datalist id="designations">
			{#each data.designations as d (d)}<option value={d}></option>{/each}
		</datalist>
		{#if form?.needConfirm}
			<label class="check warn">
				<input type="checkbox" name="confirmPrior" value="yes" required />
				Start {form.needConfirm} anyway: I checked the tray number and the work lead agrees.
			</label>
		{/if}
		<button>Start new {cl.unit.toLowerCase()} record</button>
	</form>
</section>

{#if data.trays.length}
	<ul class="tray-list">
		{#each data.trays as t (t.id)}
			<li>
				<a href="/tray/{t.id}" class="card tray-link">
					<strong>{t.designation}</strong>
					<span class="badge" class:ok={t.status === 'Complete'} class:hold={t.status === 'On hold'}>{t.status}</span>
					<progress max={data.total} value={t.passed}></progress>
					<span class="muted small">{t.passed}/{data.total} steps · last activity {t.last.slice(0, 16).replace('T', ' ')} UTC</span>
					{#if t.prior}<span class="small warn">⚠ Earlier processes not approved: {t.prior}</span>{/if}
				</a>
				<a class="small" href="/tray/{t.id}/log.csv" download>Log (CSV / Excel)</a>
			</li>
		{/each}
	</ul>
	<p class="small"><a href="/trays.csv?c={cl.id}" download>Download summary of all {cl.title} records (CSV / Excel)</a></p>
{:else}
	<p class="muted">No {cl.title} records yet.</p>
{/if}
