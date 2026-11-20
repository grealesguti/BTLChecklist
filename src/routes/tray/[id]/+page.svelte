<script>
	import { enhance } from '$app/forms';
	import { CHECKLISTS } from '#lib/checklists/index.js';
	import { stepNeeds, readyAt, COMPLETION_FIELDS, imageRef } from '#lib/checklists/common.js';
	import Field from '#lib/Field.svelte';
	import RefImage from '#lib/RefImage.svelte';
	import PhotoUpload from '#lib/PhotoUpload.svelte';
	import Meta from '#lib/Meta.svelte';

	let { data } = $props();
	let cl = $derived(CHECKLISTS[data.tray.checklist]);
	let s = $derived(data.state);
	let people = $derived(data.people);
	let involved = $derived(Object.values(s.involved));
	let nextOpen = $derived(cl.STEPS.find((st) => s.steps[st.n]?.payload.result !== 'P')?.n);
	let alarm = $derived(cl.alarm?.(s.fields));
	const derivedAt = (at) => cl.derived.filter((d) => d.at === at);

	// Bundled by Vite from each checklist's images/ folder (hashed, served same-origin).
	const IMG = import.meta.glob('/src/lib/checklists/*/images/*.{png,jpg,jpeg,PNG,JPG,JPEG}', { eager: true, query: '?url', import: 'default' });
	const ref = (entry) => imageRef(entry, cl.id);
	const src = (r) => IMG[`/src/lib/checklists/${r.path}`];
	let hasImages = $derived(cl.derived.some((d) => d.image) || cl.STEPS.some((st) => st.images?.length));
	// All pictures shown by default; one toggle at the top hides / shows them all.
	let showImages = $state(true);
	let isReviewer = $derived(!!data.me && s.fields.reviewer?.payload.value === data.me.id);
	const utc = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
</script>

<svelte:head><title>{data.tray.designation} · {cl.title}</title></svelte:head>

<section class="card hero">
	<div>
		<p class="muted small"><a href="/?c={cl.id}">← {cl.title}</a> · {cl.unit} designation</p>
		<h1>{data.tray.designation}</h1>
		<p class="muted small">{data.tray.checklist_rev} · started by {data.tray.created_by_name}</p>
		{#if cl.prior.length && !data.prior.length}
			<p class="small ok-text">✓ All earlier processes of this tray are approved (Complete).</p>
		{/if}
	</div>
	<div class="hero-side">
		<progress max={data.total} value={data.passed}></progress>
		<span class="small">{data.passed}/{data.total} steps passed</span>
		<a class="button" href="/tray/{data.tray.id}/record?print">Export PDF</a>
		<a class="button ghost" href="/tray/{data.tray.id}/history">History &amp; downloads →</a>
	</div>
</section>

<!-- Always visible while scrolling: which record, and in whose name entries are recorded (shared laptops). -->
<div class="record-bar">
	<strong>{data.tray.designation}</strong> · {cl.title} ·
	{#if data.me}recording as <strong>{data.me.name}</strong>{:else}<span class="warn">not logged in: read only</span>{/if}
	· {data.passed}/{data.total}
</div>

{#if hasImages}
	<p class="inline">
		<button type="button" class="ghost" onclick={() => (showImages = !showImages)} aria-pressed={!showImages}>
			🖼 {showImages ? 'Hide all pictures' : 'Show all pictures'}
		</button>
		<span class="muted small">Pictures show how each step must look; tap one to open it full size.</span>
	</p>
{/if}

{#if data.prior.length}
	<section class="card prior-warn" role="alert">
		<strong>⚠ Earlier processes of tray {data.tray.designation} are not approved yet.</strong>
		Check with the work lead before continuing: this {cl.title.toLowerCase()} should only be done after them.
		<ul>
			{#each data.prior as p (p.checklist)}
				<li>
					{p.title}:
					{#if p.recordId}<a href="/tray/{p.recordId}">{p.status}</a>{:else}<strong>no record</strong> (<a href="/?c={p.checklist}">start it</a>){/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if data.openIssues.length}
	<section class="card prior-warn" role="alert">
		<strong>⚠ Open issues logged for tray {data.tray.designation}:</strong>
		<ul>
			{#each data.openIssues as i (i.id)}<li>{CHECKLISTS[i.checklist]?.title ?? i.checklist}: {i.type} ({i.status})</li>{/each}
		</ul>
		<a href="/issues?tray={encodeURIComponent(data.tray.designation)}">See / update the issues →</a>
	</section>
{/if}

{#if alarm}
	<p class="alarm" role="alert">⚠ {alarm}</p>
{/if}

<section class="card">
	<h2>Record header</h2>
	<div class="grid">
		{#each cl.HEADER_FIELDS as k (k)}
			<Field key={k} def={cl.FIELDS[k]} entry={s.fields[k]} {people} />
		{/each}
	</div>
	{#each derivedAt('header') as d (d.label)}
		{@const v = d.value(s.fields)}
		<p>
			<strong>{d.label}:</strong> {v ?? '—'}
			{#if d.hint}<span class="muted small">({d.hint})</span>{/if}
		</p>
		{#if d.image && v != null}
			{@const r = { ...ref(d.image), caption: `${d.label} ${v}` }}
			<RefImage img={r} src={src(r)} mirror={d.mirror?.(v)} open={showImages} />
		{/if}
	{/each}
</section>

<section class="card">
	<h2>People involved <span class="muted small">(minimum {cl.minPeople})</span></h2>
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

{#if cl.reminders}
	<section class="card note"><strong>Handling reminders:</strong> {cl.reminders}</section>
{/if}

{#each cl.SECTIONS as section, i (section.title)}
	<section class="card">
		<h2>{section.title}</h2>
		<ol class="steps">
			{#each section.steps as st (st.n)}
				{@const a = s.steps[st.n]}
				{@const missing = stepNeeds(st).filter((k) => !s.fields[k])}
				{@const ready = st.wait ? readyAt(st, s.steps) : null}
				{@const photos = s.photos.filter((p) => p.payload.step === st.n)}
				{@const earlier = cl.strictOrder ? cl.STEPS.slice(0, cl.STEPS.indexOf(st)).find((x) => s.steps[x.n]?.payload.result !== 'P') : null}
				{@const stepAlarm = st.alarm?.(s.fields)}
				{@const blocked = (st.previous && data.previous?.status !== 'Complete') || !!earlier || !!stepAlarm}
				<li class="step" class:pass={a?.payload.result === 'P'} class:fail={a?.payload.result === 'F'} class:next={st.n === nextOpen}>
					<div class="step-n">{st.n}</div>
					<div class="step-body">
						<p>{st.text}</p>
						{#if st.warn}<p class="warn">⚠ {st.warn}</p>{/if}
						{#if st.check2}<p class="small"><strong>👥 Second check:</strong> another person verifies this step and is named on Pass.</p>{/if}
						{#each st.links ?? [] as l (l.url)}
							<a href={l.url} target="_blank" rel="noopener noreferrer" class="small">{l.label} ↗</a>
						{/each}
						{#each (st.images ?? []).map(ref) as r (r.path)}
							<RefImage img={r} src={src(r)} open={showImages} />
						{/each}
						{#if st.fields}
							<div class="grid">
								{#each st.fields as k (k)}
									<Field key={k} def={cl.FIELDS[k]} entry={s.fields[k]} {people} />
								{/each}
							</div>
						{/if}
						{#each derivedAt(st.n) as d (d.label)}<p><strong>{d.label}:</strong> {d.value(s.fields) ?? '—'}</p>{/each}
						{#if st.blockOnAlarm && alarm}<p class="alarm" role="alert">⚠ {alarm}</p>{/if}
						{#if stepAlarm}<p class="alarm" role="alert">⚠ {stepAlarm}</p>{/if}
						{#if earlier && !a}<p class="small muted">In order: pass step {earlier.n} first.</p>{/if}
						{#if st.wait}
							<p class="small" class:warn={ready == null || Date.now() < ready}>
								⏱ {ready == null ? `Curing starts when step ${st.wait.after} is passed (${st.wait.hours} h minimum).` : `Cured from ${utc(ready)} (${st.wait.hours} h after step ${st.wait.after}).`}
							</p>
						{/if}
						{#if st.previous && data.previous?.status !== 'Complete'}<p class="small warn">Needs the {data.previous.title} record of {data.tray.designation} to be Complete.</p>{/if}
						{#if photos.length}
							<div class="photos">
								{#each photos as p (p.key)}
									<a href="/photo/{p.payload.file}" target="_blank" rel="noopener" title="{p.payload.caption || p.payload.name} — {p.person_name}, {p.at.slice(0, 16).replace('T', ' ')} UTC">
										<img src="/photo/{p.payload.file}" alt={p.payload.caption || `Photo of step ${st.n}`} loading="lazy" />
									</a>
								{/each}
							</div>
						{/if}
						<PhotoUpload step={st.n} required={st.photo} count={photos.length} />
						{#if st.photo && !photos.length}
							<p class="small warn">⚠ No photo yet: please upload one. You can still pass, but the record will show a warning.</p>
						{/if}
						{#if missing.length}
							<p class="small muted">Pass needs: {missing.map((k) => cl.FIELDS[k].label).join(', ')}</p>
						{/if}
						{#if a}
							<p class="current">
								<span class="badge" class:ok={a.payload.result === 'P'} class:bad={a.payload.result === 'F'}>
									{a.payload.result === 'P' ? 'Pass' : 'Fail'}
								</span>
								<Meta entry={a} />
								{#if a.payload.checkedByName}<span class="small">· second check: <strong>{a.payload.checkedByName}</strong></span>{/if}
								{#if a.payload.comment}<br /><span class="small">“{a.payload.comment}”</span>{/if}
							</p>
						{/if}
						<form method="post" action="?/step" use:enhance class="inline">
							<input type="hidden" name="step" value={st.n} />
							{#if st.check2}
								<!-- Not `required`: Fail needs no checker; the server requires one for Pass. -->
								<select name="checker" aria-label="Second check by">
									<option value="">Second check by… (needed for Pass)</option>
									{#each people.filter((p) => p.id !== data.me?.id) as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
								</select>
							{/if}
							<input name="comment" maxlength="500" placeholder={a ? 'Comment' : 'Comment (required for Fail)'} />
							{#if a}<input name="reason" required maxlength="300" placeholder="Reason for revision" />{/if}
							<button name="result" value="P" class="pass-btn" disabled={missing.length > 0 || blocked}>Pass</button>
							<button name="result" value="F" class="fail-btn">Fail</button>
						</form>
					</div>
				</li>
			{/each}
		</ol>

		<div class="grid">
			{#each section.fields ?? [] as k (k)}
				<Field key={k} def={cl.FIELDS[k]} entry={s.fields[k]} {people} />
			{/each}
		</div>
		{#each cl.refTables.filter((t) => t.section === i) as t (t.title)}
			<details open={t.open}>
				<summary>{t.title}</summary>
				<table>
					<thead><tr>{#each t.head as h (h)}<th>{h}</th>{/each}</tr></thead>
					<tbody>
						{#each t.rows as row, r (r)}<tr>{#each row as c, j (j)}<td>{c}</td>{/each}</tr>{/each}
					</tbody>
				</table>
			</details>
		{/each}
	</section>
{/each}

{#if cl.T.components}
	<section class="card">
		<h2>{cl.T.components}</h2>
		{#each Object.entries(cl.COMPONENTS) as [k, label] (k)}
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
{/if}

<section class="card">
	<h2>{cl.T.exceptions}</h2>
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
				{#each cl.STEPS as st (st.n)}<option value={st.n}>Step {st.n}</option>{/each}
			</select>
			<textarea name="issue" maxlength="500" required placeholder="Issue / reference"></textarea>
			<textarea name="action" maxlength="500" placeholder="Action / recheck result (optional now)"></textarea>
			<button>Add</button>
		</form>
	</details>
</section>

<section class="card">
	<h2>{cl.T.completion}</h2>
	{#if data.issues.length}
		<ul class="issues">
			{#each data.issues as issue (issue)}<li>{issue}</li>{/each}
		</ul>
	{:else}
		<p class="ok-text">All completion conditions met.</p>
	{/if}
	{#each data.warnings as w (w)}<p class="warn">⚠ {w}</p>{/each}
	<div class="grid">
		{#each COMPLETION_FIELDS as k (k)}
			<Field key={k} def={cl.FIELDS[k]} entry={s.fields[k]} {people} />
		{/each}
	</div>
</section>
