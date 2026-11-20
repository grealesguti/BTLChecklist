<script>
	let { data } = $props();
	let showSuperseded = $state(true);
	let rows = $derived(showSuperseded ? data.log : data.log.filter((e) => e.current));
	const base = $derived(`/tray/${data.tray.id}`);
</script>

<svelte:head><title>History · {data.tray.designation}</title></svelte:head>

<section class="card hero">
	<div>
		<p class="muted small"><a href={base}>← Back to checklist</a></p>
		<h1>{data.tray.designation} — history</h1>
		<p class="muted small">Every recorded entry, newest first. Entries are never removed; changes appear as revisions.</p>
	</div>
	<div class="hero-side downloads">
		<a class="button" href="{base}/log.csv" download>Log (CSV / Excel)</a>
		<a class="button" href="{base}/record.tex" download>Record (LaTeX / Overleaf)</a>
		<a class="button ghost" href="{base}/record">Printable record (PDF)</a>
	</div>
</section>

<section class="card">
	<label class="check"><input type="checkbox" bind:checked={showSuperseded} /> Show superseded entries</label>
	<div class="table-wrap">
		<table class="log">
			<thead>
				<tr><th>#</th><th>Time (UTC)</th><th>Name</th><th>Entry</th><th>Revision</th></tr>
			</thead>
			<tbody>
				{#each rows as e (e.id)}
					<tr class:superseded={!e.current}>
						<td>{e.id}</td>
						<td class="nowrap">{e.at.slice(0, 16).replace('T', ' ')}</td>
						<td>{e.person_name}<br /><span class="muted small">{e.email}</span></td>
						<td>
							<strong>{e.d.item}</strong>: {e.d.value}
							{#if e.d.note}<br /><span class="small">{e.d.note}</span>{/if}
						</td>
						<td class="small">
							{#if e.rev > 1}rev. {e.rev}, replaces #{e.supersedes}{#if e.payload.reason}<br />“{e.payload.reason}”{/if}{:else}original{/if}
							{#if !e.current}<br /><span class="badge">superseded</span>{/if}
						</td>
					</tr>
				{/each}
				<tr>
					<td></td>
					<td class="nowrap">{data.tray.created_at.slice(0, 16).replace('T', ' ')}</td>
					<td>{data.tray.created_by_name}<br /><span class="muted small">{data.tray.email}</span></td>
					<td><strong>Record created</strong></td>
					<td class="small">original</td>
				</tr>
			</tbody>
		</table>
	</div>
</section>
