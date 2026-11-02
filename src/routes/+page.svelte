<script>
	import { enhance } from '$app/forms';
	let { data } = $props();
</script>

<svelte:head><title>BTL Tray Checklist</title></svelte:head>

<section class="card">
	<h1>Trays</h1>
	<form method="post" action="?/createTray" use:enhance class="inline">
		<input name="designation" placeholder="Tray designation number" required maxlength="40"
			pattern={'[A-Za-z0-9][A-Za-z0-9 ._\\-]{0,39}'} title="Letters, digits, space . _ - (max 40)" />
		<button>Start new tray record</button>
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
				</a>
			</li>
		{/each}
	</ul>
	<p class="small"><a href="/trays.csv" download>Download summary of all trays (CSV / Excel)</a></p>
{:else}
	<p class="muted">No trays recorded yet.</p>
{/if}
