<script>
	import { onMount } from 'svelte';
	import { CHECKLISTS } from '#lib/checklists/index.js';
	import { sectionFields, COMPLETION_FIELDS } from '#lib/checklists/common.js';

	let { data } = $props();
	let cl = $derived(CHECKLISTS[data.tray.checklist]);
	let s = $derived(data.state);
	const derivedIn = (steps) => cl.derived.filter((d) => steps.some((st) => st.n === d.at));
	const when = (e) => (e ? `${e.person_name}, ${e.at.slice(0, 10)}${e.payload.checkedByName ? ` · second check: ${e.payload.checkedByName}` : ''}` : '');
	const val = (e) => (e ? String(e.payload.name ?? e.payload.value) : '');
	const rev = (e) => (e && e.rev > 1 ? ` (rev. ${e.rev})` : '');
	// "Export PDF" on the checklist links here with ?print: open the print / Save-as-PDF dialog directly.
	onMount(() => new URLSearchParams(location.search).has('print') && window.print());
</script>

<svelte:head><title>Record · {data.tray.designation}</title></svelte:head>

<div class="record">
	<p class="no-print">
		<a href="/tray/{data.tray.id}/history">← Back to history</a>
		<button onclick={() => window.print()}>Print / Save as PDF</button>
	</p>

	<h1>{cl.docTitle}</h1>
	<p class="small">
		{data.tray.checklist_rev} · Exported {data.exportedAt.slice(0, 16).replace('T', ' ')} UTC ·
		entries marked “(rev. N)” were revised; full log at the end.
	</p>

	<table>
		<tbody>
			<tr><th>{cl.unit} designation number</th><td>{data.tray.designation}</td></tr>
			{#each cl.HEADER_FIELDS as k (k)}
				<tr><th>{cl.FIELDS[k].label}</th><td>{val(s.fields[k])}{rev(s.fields[k])}</td></tr>
			{/each}
			{#each cl.derived.filter((d) => d.at === 'header') as d (d.label)}
				<tr><th>{d.label} (automatic)</th><td>{d.value(s.fields) ?? ''}</td></tr>
			{/each}
		</tbody>
	</table>

	<h2>People involved</h2>
	<table>
		<thead><tr><th>Name</th><th>Role</th><th>Added by / date</th></tr></thead>
		<tbody>
			{#each Object.values(s.involved) as a (a.key)}
				<tr><td>{a.payload.name}{a.payload.active ? '' : ' (not involved)'}</td><td>{a.payload.role}{rev(a)}</td><td>{when(a)}</td></tr>
			{/each}
		</tbody>
	</table>

	{#each cl.SECTIONS as section (section.title)}
		<h2>{section.title}</h2>
		<table>
			<thead><tr><th>No.</th><th>Action / check</th><th>Result</th><th>Name / date</th></tr></thead>
			<tbody>
				{#each section.steps as st (st.n)}
					{@const a = s.steps[st.n]}
					<tr>
						<td>{st.n}</td>
						<td>
							{st.text}{#if st.warn} <strong>{st.warn}</strong>{/if}{#if a?.payload.comment}<br /><em>Comment: {a.payload.comment}</em>{/if}
							{#if s.photos.some((p) => p.payload.step === st.n)}
								<div class="photos">
									{#each s.photos.filter((p) => p.payload.step === st.n) as p (p.key)}
										<img src="/photo/{p.payload.file}" alt={p.payload.caption || `Photo of step ${st.n}`} title="{p.person_name}, {p.at.slice(0, 16).replace('T', ' ')} UTC" />
									{/each}
								</div>
							{/if}
						</td>
						<td>{a ? (a.payload.result === 'P' ? '☒ P ☐ F' : '☐ P ☒ F') : '☐ P ☐ F'}{rev(a)}</td>
						<td>{when(a)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<table>
			<tbody>
				{#each sectionFields(section) as k (k)}
					<tr><th>{cl.FIELDS[k].label}</th><td>{val(s.fields[k])}{rev(s.fields[k])}</td></tr>
				{/each}
				{#each derivedIn(section.steps) as d (d.label)}
					<tr><th>{d.label} (automatic)</th><td>{d.value(s.fields) ?? '—'}</td></tr>
				{/each}
			</tbody>
		</table>
	{/each}

	{#each cl.refTables as t (t.title)}
		<h2>{t.title}</h2>
		<table>
			<thead><tr>{#each t.head as h (h)}<th>{h}</th>{/each}</tr></thead>
			<tbody>{#each t.rows as row, r (r)}<tr>{#each row as c, j (j)}<td>{c}</td>{/each}</tr>{/each}</tbody>
		</table>
	{/each}

	{#if cl.T.components}
		<h2>{cl.T.components}</h2>
		<table>
			<thead><tr><th>Component</th><th>Accounted</th><th>Location / remarks</th><th>Name / date</th></tr></thead>
			<tbody>
				{#each Object.entries(cl.COMPONENTS) as [k, label] (k)}
					{@const a = s.components[k]}
					<tr><td>{label}</td><td>{a?.payload.accounted ? '☒' : '☐'}{rev(a)}</td><td>{a?.payload.remarks ?? ''}</td><td>{when(a)}</td></tr>
				{/each}
			</tbody>
		</table>
	{/if}

	<h2>{cl.T.exceptions}</h2>
	<table>
		<thead><tr><th>Step</th><th>Issue</th><th>Action / recheck result</th><th>Name / date</th></tr></thead>
		<tbody>
			{#each s.exceptions as x (x.key)}
				<tr><td>{x.payload.step}</td><td>{x.payload.issue}</td><td>{x.payload.action}{rev(x)}</td><td>{when(x)}</td></tr>
			{/each}
		</tbody>
	</table>

	<h2>{cl.T.completion}</h2>
	<table>
		<tbody>
			{#each COMPLETION_FIELDS as k (k)}
				<tr><th>{cl.FIELDS[k].label}</th><td>{val(s.fields[k])}{rev(s.fields[k])}</td></tr>
			{/each}
		</tbody>
	</table>
	{#if data.issues.length}
		<p><strong>Open items:</strong> {data.issues.join('; ')}</p>
	{/if}

	<h2 class="page-break">Full entry log (including superseded entries)</h2>
	<table class="log">
		<thead><tr><th>#</th><th>Time (UTC)</th><th>Name</th><th>Entry</th><th>Revision</th></tr></thead>
		<tbody>
			{#each data.log as e (e.id)}
				<tr class:superseded={!e.current}>
					<td>{e.id}</td>
					<td class="nowrap">{e.at.slice(0, 16).replace('T', ' ')}</td>
					<td>{e.person_name}</td>
					<td>{e.d.item}: {e.d.value}{e.d.note ? ` — ${e.d.note}` : ''}</td>
					<td>
						{e.rev > 1 ? `rev. ${e.rev}, replaces #${e.supersedes}` : 'original'}{e.payload.reason ? `: ${e.payload.reason}` : ''}{e.current ? '' : ' [superseded]'}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
