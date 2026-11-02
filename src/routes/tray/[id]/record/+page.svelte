<script>
	import { SECTIONS, FIELDS, HEADER_FIELDS, COMPONENTS, rollerOrientation, sectionFields } from '#lib/checklist.js';

	let { data } = $props();
	let s = $derived(data.state);
	const when = (e) => (e ? `${e.person_name}, ${e.at.slice(0, 10)}` : '');
	const val = (e) => (e ? String(e.payload.name ?? e.payload.value) : '');
	const rev = (e) => (e && e.rev > 1 ? ` (rev. ${e.rev})` : '');
</script>

<svelte:head><title>Record · {data.tray.designation}</title></svelte:head>

<div class="record">
	<p class="no-print">
		<a href="/tray/{data.tray.id}/history">← Back to history</a>
		<button onclick={() => window.print()}>Print / Save as PDF</button>
	</p>

	<h1>BTL Tray assembly and integration</h1>
	<p class="small">
		{data.tray.checklist_rev} · Exported {data.exportedAt.slice(0, 16).replace('T', ' ')} UTC ·
		entries marked “(rev. N)” were revised; full log at the end.
	</p>

	<table>
		<tbody>
			<tr><th>Tray designation number</th><td>{data.tray.designation}</td></tr>
			{#each HEADER_FIELDS as k (k)}
				<tr><th>{FIELDS[k].label}</th><td>{val(s.fields[k])}{rev(s.fields[k])}</td></tr>
			{/each}
			<tr><th>Roller orientation (automatic)</th><td>{rollerOrientation(s.fields.insertionSide?.payload.value, s.fields.cmsTray?.payload.value) ?? ''}</td></tr>
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

	{#each SECTIONS as section (section.title)}
		<h2>{section.title}</h2>
		<table>
			<thead><tr><th>No.</th><th>Action / check</th><th>Result</th><th>Name / date</th></tr></thead>
			<tbody>
				{#each section.steps as st (st.n)}
					{@const a = s.steps[st.n]}
					<tr>
						<td>{st.n}</td>
						<td>{st.text}{#if st.warn} <strong>{st.warn}</strong>{/if}{#if a?.payload.comment}<br /><em>Comment: {a.payload.comment}</em>{/if}</td>
						<td>{a ? (a.payload.result === 'P' ? '☒ P ☐ F' : '☐ P ☒ F') : '☐ P ☐ F'}{rev(a)}</td>
						<td>{when(a)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<table>
			<tbody>
				{#each sectionFields(section) as k (k)}
					<tr><th>{FIELDS[k].label}</th><td>{val(s.fields[k])}{rev(s.fields[k])}</td></tr>
				{/each}
			</tbody>
		</table>
	{/each}
	<p><strong>Total tray mass:</strong> {data.mass ?? '—'} kg</p>

	<h2>4. Component accounting and storage</h2>
	<table>
		<thead><tr><th>Component</th><th>Accounted</th><th>Location / remarks</th><th>Name / date</th></tr></thead>
		<tbody>
			{#each Object.entries(COMPONENTS) as [k, label] (k)}
				{@const a = s.components[k]}
				<tr><td>{label}</td><td>{a?.payload.accounted ? '☒' : '☐'}{rev(a)}</td><td>{a?.payload.remarks ?? ''}</td><td>{when(a)}</td></tr>
			{/each}
		</tbody>
	</table>

	<h2>5. Exceptions and corrective actions</h2>
	<table>
		<thead><tr><th>Step</th><th>Issue</th><th>Action / recheck result</th><th>Name / date</th></tr></thead>
		<tbody>
			{#each s.exceptions as x (x.key)}
				<tr><td>{x.payload.step}</td><td>{x.payload.issue}</td><td>{x.payload.action}{rev(x)}</td><td>{when(x)}</td></tr>
			{/each}
		</tbody>
	</table>

	<h2>6. Completion review</h2>
	<table>
		<tbody>
			{#each ['status', 'workLead', 'reviewer', 'cernboxLink'] as k (k)}
				<tr><th>{FIELDS[k].label}</th><td>{val(s.fields[k])}{rev(s.fields[k])}</td></tr>
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
