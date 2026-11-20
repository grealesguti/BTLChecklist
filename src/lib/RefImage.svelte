<script>
	/**
	 * Reference picture for a step: caption, "to avoid" frame, numbered markers drawn in SVG
	 * (percent positions, no inline styles: the CSP forbids them) and a legend under the picture.
	 * Open by default; `open` (the page's show/hide-all toggle) opens or closes it, and each picture
	 * can still be toggled on its own (native <details>).
	 */
	let { img, src, mirror = false, open = true } = $props();
</script>

<details class="step-img" class:avoid={img.avoid} {open}>
	<summary class="small">{img.avoid ? '✗ TO AVOID: ' : '🖼 '}{img.caption}</summary>
	<figure>
		<div class="marked">
			<a href={src} target="_blank" rel="noopener"><img {src} alt={img.caption} loading="lazy" class:mirror /></a>
			{#if img.marks.length}
				<svg class="marks" aria-hidden="true">
					{#each img.marks as [x, y], i (i)}
						<circle cx="{x}%" cy="{y}%" r="13" />
						<text x="{x}%" y="{y}%" dy="5" text-anchor="middle">{i + 1}</text>
					{/each}
				</svg>
			{/if}
		</div>
		{#if img.avoid}<figcaption class="avoid-text">✗ This shows what must NOT happen.</figcaption>{/if}
		{#if img.marks.length}
			<ol class="legend">
				{#each img.marks as m, i (i)}<li>{m[2]}</li>{/each}
			</ol>
		{/if}
	</figure>
</details>
