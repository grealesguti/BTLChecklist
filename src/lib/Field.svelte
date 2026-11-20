<script>
	import { enhance } from '$app/forms';
	import Meta from './Meta.svelte';
	import { allowedPerson } from './checklists/common.js';

	let { key, def, entry, people } = $props();
	const maxlength = $derived(def.type === 'long' ? 1000 : def.type === 'url' ? 300 : 100);
</script>

<form method="post" action="?/field" use:enhance class="field">
	<input type="hidden" name="key" value={key} />
	<label for="f-{key}">{def.label}</label>
	{#if entry}
		<div class="current">
			<strong>{entry.payload.name ?? entry.payload.value}</strong>
			<Meta {entry} />
		</div>
	{/if}
	<div class="row">
		{#if def.type === 'select' || def.type === 'person'}
			<select id="f-{key}" name="value" required>
				<option value="" disabled selected>{entry ? 'New value…' : 'Choose…'}</option>
				{#if def.type === 'select'}
					{#each def.options as o (o)}<option>{o}</option>{/each}
				{:else}
					{#each people.filter((p) => allowedPerson(def, p)) as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
				{/if}
			</select>
		{:else if def.type === 'check'}
			{#if !entry}<label class="check"><input id="f-{key}" name="value" type="checkbox" value="Passed" required /> Passed</label>{/if}
		{:else if def.type === 'date'}
			<!-- Native picker; prefilled with today (local) unless noDefault (e.g. expiry dates), still needs Save. -->
			<input id="f-{key}" name="value" type="date" required value={def.noDefault ? '' : new Date().toLocaleDateString('sv')} />
		{:else if def.type === 'long'}
			<textarea id="f-{key}" name="value" required {maxlength} rows="2" placeholder={entry ? 'New value…' : ''}></textarea>
		{:else}
			<input id="f-{key}" name="value" required {maxlength}
				type={def.type === 'url' ? 'url' : 'text'}
				inputmode={def.type === 'int' ? 'numeric' : def.type === 'num' ? 'decimal' : undefined}
				placeholder={entry ? 'New value…' : def.type === 'url' ? 'https://…' : ''} />
		{/if}
		{#if entry && def.type === 'check'}
			<span class="muted small">Ticked. To record a problem, add an exception (section 5).</span>
		{:else}
			{#if entry}
				<input name="reason" required maxlength="300" placeholder="Reason for revision" />
			{/if}
			<button>{entry ? 'Revise' : 'Save'}</button>
		{/if}
	</div>
</form>
