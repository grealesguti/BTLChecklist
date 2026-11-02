<script>
	import { enhance } from '$app/forms';
	import { SECTIONS, FIELDS, HEADER_FIELDS, COMPONENTS, FASTENERS, STEPS, ROLLER_IMAGE, rollerOrientation, stepNeeds, foamAlarm, FOAM_ALARM } from '#lib/checklist.js';
	import Field from '#lib/Field.svelte';
	import Meta from '#lib/Meta.svelte';

	let { data } = $props();
	let s = $derived(data.state);
	let people = $derived(data.people);
	let involved = $derived(Object.values(s.involved));
	let nextOpen = $derived(STEPS.find((st) => s.steps[st.n]?.payload.result !== 'P')?.n);

	// Bundled by Vite from the project-root Images/ folder (hashed, served same-origin).
	const IMG = import.meta.glob('/Images/*.png', { eager: true, query: '?url', import: 'default' });
	const ALL_IMAGES = [ROLLER_IMAGE, ...STEPS.flatMap((st) => st.images ?? [])];
	let rollers = $derived(rollerOrientation(s.fields.insertionSide?.payload.value, s.fields.cmsTray?.payload.value));
	const caption = (f) => f.replace('.png', '').replace(/([a-z])([A-Z])/g, '$1 $2');
	let shown = $state({});
	let isReviewer = $derived(!!data.me && s.fields.reviewer?.payload.value === data.me.id);
	const showAll = (v) => (shown = Object.fromEntries(ALL_IMAGES.map((f) => [f, v])));
</script>

<svelte:head><title>{data.tray.designation} · BTL Tray Checklist</title></svelte:head>

<section class="card hero">
	<div>
		<p class="muted small">Tray designation</p>
		<h1>{data.tray.designation}</h1>
		<p class="muted small">{data.tray.checklist_rev} · started by {data.tray.created_by_name}</p>
	</div>
	<div class="hero-side">
		<progress max={data.total} value={data.passed}></progress>
		<span class="small">{data.passed}/{data.total} steps passed</span>
		<a class="button ghost" href="/tray/{data.tray.id}/history">History &amp; downloads →</a>
		<span class="inline">
			<button type="button" class="ghost" onclick={() => showAll(true)}>Show all images</button>
			<button type="button" class="ghost" onclick={() => showAll(false)}>Hide all images</button>
		</span>
	</div>
</section>

{#if foamAlarm(s.fields)}
	<p class="alarm" role="alert">⚠ {FOAM_ALARM}</p>
{/if}

<section class="card">
	<h2>Record header</h2>
	<div class="grid">
		{#each HEADER_FIELDS as k (k)}
			<Field key={k} def={FIELDS[k]} entry={s.fields[k]} {people} />
		{/each}
	</div>
	<p>
		<strong>Roller orientation:</strong>
		{rollers ?? '— set insertion location and CMS tray —'}
		<span class="muted small">(automatic from ±Z and CMS tray)</span>
	</p>
	{#if rollers}
		<details class="step-img" bind:open={shown[ROLLER_IMAGE]}>
			<summary class="small">🖼 Roller positioning {rollers}</summary>
			<img src={IMG[`/Images/${ROLLER_IMAGE}`]} alt="Roller positioning {rollers}" class:mirror={rollers === '-X'} />
		</details>
	{/if}
</section>

<section class="card">
	<h2>People involved <span class="muted small">(minimum three)</span></h2>
	{#if involved.length}
		<ul class="plain">
			{#each involved as a (a.key)}
				<li class:inactive={!a.payload.active}>
					<strong>{a.payload.name}</strong>{#if !a.payload.active} — marked not involved{:else if a.payload.role} — {a.payload.role}{/if}
					<span class="small muted">added by</span> <Meta entry={a} />
					<details>
						<summary class="small">Revise</summary>
						<form method="post" action="?/involve" use:enhance class="inline">
							<input type="hidden" name="person" value={a.key} />
							<select name="active">
								<option value="yes">Involved</option>
								{#if isReviewer}<option value="no">Not involved</option>{/if}
							</select>
							{#if !isReviewer}<span class="muted small">Only the reviewer{s.fields.reviewer ? ` (${s.fields.reviewer.payload.name})` : ''} can mark someone as not involved.</span>{/if}
							<input name="reason" required maxlength="300" placeholder="Reason for revision" />
							<button>Revise</button>
						</form>
					</details>
				</li>
			{/each}
		</ul>
	{/if}
	<form method="post" action="?/involve" use:enhance class="inline">
		<select name="person" required>
			<option value="" disabled selected>Add person…</option>
			{#each people.filter((p) => !s.involved[p.id]) as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
		</select>
		<button>Add</button>
	</form>
	<p class="muted small">
		People can be added without logging in themselves; each entry records who added them and when.
		Names not yet listed: “+ Add person” at the top (no login: they can’t pass/fail or review until they set a password
		via “Register / set password”).
	</p>
</section>

<section class="card note">
	<strong>Handling reminders:</strong> Do not lose the fiber holder, rollers or L profiles. Do not press on the LYSO when fitting
	Airex / Kapton. Leave the last bottom ear in the pipe region during the ear-removal step. Check scaffolding sign-off before
	pulling from inside. Rebound is expected at the pull-out step.
</section>

{#each SECTIONS as section, i (section.title)}
	<section class="card">
		<h2>{section.title}</h2>
		<ol class="steps">
			{#each section.steps as st (st.n)}
				{@const a = s.steps[st.n]}
				{@const missing = stepNeeds(st).filter((k) => !s.fields[k])}
				<li class="step" class:pass={a?.payload.result === 'P'} class:fail={a?.payload.result === 'F'} class:next={st.n === nextOpen}>
					<div class="step-n">{st.n}</div>
					<div class="step-body">
						<p>{st.text}</p>
						{#if st.warn}<p class="warn">⚠ {st.warn}</p>{/if}
						{#each st.links ?? [] as l (l.url)}
							<a href={l.url} target="_blank" rel="noopener noreferrer" class="small">{l.label} ↗</a>
						{/each}
						{#each st.images ?? [] as f (f)}
							<details class="step-img" bind:open={shown[f]}>
								<summary class="small">🖼 {caption(f)}</summary>
								<a href={IMG[`/Images/${f}`]} target="_blank" rel="noopener"><img src={IMG[`/Images/${f}`]} alt={caption(f)} loading="lazy" /></a>
							</details>
						{/each}
						{#if st.fields}
							<div class="grid">
								{#each st.fields as k (k)}
									<Field key={k} def={FIELDS[k]} entry={s.fields[k]} {people} />
								{/each}
							</div>
							{#if st.n === '19'}<p><strong>Total tray mass:</strong> {data.mass ?? '—'} kg</p>{/if}
							{#if st.fields.includes('foamLayers') && foamAlarm(s.fields)}<p class="alarm" role="alert">⚠ {FOAM_ALARM}</p>{/if}
						{/if}
						{#if missing.length}
							<p class="small muted">Pass needs: {missing.map((k) => FIELDS[k].label).join(', ')}</p>
						{/if}
						{#if a}
							<p class="current">
								<span class="badge" class:ok={a.payload.result === 'P'} class:bad={a.payload.result === 'F'}>
									{a.payload.result === 'P' ? 'Pass' : 'Fail'}
								</span>
								<Meta entry={a} />
								{#if a.payload.comment}<br /><span class="small">“{a.payload.comment}”</span>{/if}
							</p>
						{/if}
						<form method="post" action="?/step" use:enhance class="inline">
							<input type="hidden" name="step" value={st.n} />
							<input name="comment" maxlength="500" placeholder={a ? 'Comment' : 'Comment (required for Fail)'} />
							{#if a}<input name="reason" required maxlength="300" placeholder="Reason for revision" />{/if}
							<button name="result" value="P" class="pass-btn" disabled={missing.length > 0}>Pass</button>
							<button name="result" value="F" class="fail-btn">Fail</button>
						</form>
					</div>
				</li>
			{/each}
		</ol>

		<div class="grid">
			{#each section.fields as k (k)}
				<Field key={k} def={FIELDS[k]} entry={s.fields[k]} {people} />
			{/each}
		</div>
		{#if i === 1}
			<details>
				<summary>Fastener and component reference</summary>
				<table>
					<tbody>
						{#each FASTENERS as [app, spec] (app)}<tr><td>{app}</td><td>{spec}</td></tr>{/each}
					</tbody>
				</table>
			</details>
		{/if}
	</section>
{/each}

<section class="card">
	<h2>4. Component accounting and storage</h2>
	{#each Object.entries(COMPONENTS) as [k, label] (k)}
		{@const a = s.components[k]}
		<form method="post" action="?/component" use:enhance class="component">
			<input type="hidden" name="key" value={k} />
			<strong>{label}</strong>
			{#if a}
				<span class="current">
					<span class="badge" class:ok={a.payload.accounted}>{a.payload.accounted ? 'Accounted' : 'Not accounted'}</span>
					{a.payload.remarks}
					<Meta entry={a} />
				</span>
			{/if}
			<div class="inline">
				<label class="check"><input type="checkbox" name="accounted" value="yes" /> Accounted for</label>
				<input name="remarks" maxlength="200" placeholder="Installed / storage location / remarks" />
				{#if a}<input name="reason" required maxlength="300" placeholder="Reason for revision" />{/if}
				<button>{a ? 'Revise' : 'Save'}</button>
			</div>
		</form>
	{/each}
</section>

<section class="card">
	<h2>5. Exceptions and corrective actions</h2>
	{#each s.exceptions as x (x.key)}
		<div class="exception" class:open={!x.payload.action}>
			<p>
				{#if x.payload.step}<strong>Step {x.payload.step}:</strong>{/if}
				{x.payload.issue}
				<br /><span class="small">Action: {x.payload.action || '— none yet —'}</span>
				<Meta entry={x} />
			</p>
			<details>
				<summary class="small">Record action / revise</summary>
				<form method="post" action="?/exception" use:enhance class="stack">
					<input type="hidden" name="key" value={x.key} />
					<input type="hidden" name="step" value={x.payload.step} />
					<input type="hidden" name="issue" value={x.payload.issue} />
					<textarea name="action" maxlength="500" required placeholder="Action / recheck result"></textarea>
					<input name="reason" required maxlength="300" placeholder="Reason for revision" />
					<button>Save</button>
				</form>
			</details>
		</div>
	{/each}
	<details>
		<summary>Add exception</summary>
		<form method="post" action="?/exception" use:enhance class="stack">
			<select name="step">
				<option value="">Step (optional)</option>
				{#each STEPS as st (st.n)}<option value={st.n}>Step {st.n}</option>{/each}
			</select>
			<textarea name="issue" maxlength="500" required placeholder="Issue / reference"></textarea>
			<textarea name="action" maxlength="500" placeholder="Action / recheck result (optional now)"></textarea>
			<button>Add</button>
		</form>
	</details>
</section>

<section class="card">
	<h2>6. Completion review</h2>
	{#if data.issues.length}
		<ul class="issues">
			{#each data.issues as issue (issue)}<li>{issue}</li>{/each}
		</ul>
	{:else}
		<p class="ok-text">All completion conditions met.</p>
	{/if}
	<div class="grid">
		{#each ['workLead', 'reviewer', 'cernboxLink', 'status'] as k (k)}
			<Field key={k} def={FIELDS[k]} entry={s.fields[k]} {people} />
		{/each}
	</div>
</section>
