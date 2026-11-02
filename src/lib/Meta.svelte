<script>
	/** Who / when / revision line for a recorded entry. */
	let { entry } = $props();
</script>

<span class="meta">
	{entry.person_name} · {entry.at.slice(0, 16).replace('T', ' ')} UTC
	{#if entry.rev > 1}<span class="badge rev" title={entry.payload.reason}>rev. {entry.rev}</span>{/if}
</span>
