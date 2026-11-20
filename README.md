# BTL Checklists

Assembly checklists for BTL trays: people tick steps, upload photos, every entry is logged
(name, session identity, UTC time), nothing can be deleted, changes are revisions with a
reason. See `ROADMAP.md` for the design.

Everyone must log in first (`/login`). On a new installation (or the first start of this version)
the first person who logs in is asked to become **root** and enter the contact phone shown at the
bottom of every page, next to the CERN emergency number.

Processes, in order for each tray (tabs on the home page; one record per tray in each). Every record
warns when an earlier process of the same tray is missing or not Complete; starting one then needs
an explicit confirmation. Insertion is always last, before commissioning.

| # | Checklist | Folder | Notes |
|---|---|---|---|
| 1 | Sensor gluing (PT1000) | `src/lib/checklists/sensor/` | from `docs/Manual_PreheaterAssembly…pptx` + photos, draft |
| 2 | Preheater gluing (resistors) | `src/lib/checklists/preheater/` | step 03 needs the sensor record Complete |
| 3 | Pipe clamp & preheater assembly | `src/lib/checklists/pipeclampandpreheaterassembly/` | from photos, draft |
| 4 | BTL tray insertion | `src/lib/checklists/tray/` | from `docs/main.tex` |

**Issues found later** (`/issues`): anyone logs a problem noticed after a process was finished
(kind of problem from a per-process list with the usual action, description, photos, status
updates). Open issues are shown on the tray's records. Append-only like everything else.

On a phone: the photo button opens the camera; photos are shrunk in the browser (≤1600 px JPEG)
and stored as `data/uploads/<checklist>_<tray>_step<NN>_<UTC time>_<hash>.jpg`. A step expecting
a photo can still be passed without one, but the record then shows a warning.

## Develop

```
npm install
npm run dev          # http://localhost:5173, identity = dev@localhost
npm test             # validation / escaping / revision / checklist-definition tests
npm run dev:smoke    # dev server on :5199 with a throwaway DB (tmp/smoke.db)
npm run smoke        # end-to-end check against it
```

## Adding or changing a checklist

Each checklist is one folder in `src/lib/checklists/<id>/`:
- `checklist.js`: steps, fields, reference tables (copy an existing one).
- `images/`: step pictures (`.png`/`.jpg`, ≤1280 px: `mogrify -resize "1280x1280>" -quality 82 -strip`).
- `docs/`: source documents.

List the new one in `src/lib/checklists/index.js` (`CHECKLISTS` and `CHAIN`, the process order).
`npm test` checks every field, step, image and marker. Never rename an `id` once records exist.

Pictures in a step's `images: [...]`: `'file.jpg'` (own `images/`), `'<other id>/file.jpg'` (reuse
another checklist's), or `{ f, caption, avoid, marks: [[x%, y%, 'label'], …] }`: numbered red markers
drawn over the picture with a legend under it (beginner-friendly). Files named `TOAVOID_…` are framed
in red as "what must not happen", `NOTPROCEDURAL_…` are "reference only".

Step options: `fields` (recorded inside the step, needed to pass), `requires`, `warn`, `links`,
`images`, `photo: true` (a photo is expected: warning if passed without), `wait: { after, hours }`
(curing: pass only `hours` after step `after` passed), `previous: true` (needs the record of the
previous process for the same tray to be Complete), `check2: true` (Pass names a second person, not
the submitter), `alarm: (fields) => message | null` (blocks Pass, e.g. PT1000 out of range).
Checklist options: `strictOrder` (each step passes only after all earlier ones), `minPeople`,
`knownIssues: [{ type, hint }]` (choices on the Issues page).
Field option for dates: `notPast` (expiry: refused when saved and again when the step passes).

### Human-error guards (all server-side)

| Error | Guard |
|---|---|
| Step skipped or done out of order (gluing) | `strictOrder` on sensor / preheater gluing |
| One person's slip unnoticed | `check2` second person on critical steps (placement, wire glue, results, torque, scales, insertion tool) |
| Broken / wrong PT1000 found too late | measured before gluing and after curing; outside 1000–1200 Ω blocks Pass |
| Expired or badly mixed glue | expiry in the past refused; purge first bead of a new nozzle; work-life warning |
| Cure timer started early / stencil moved | timer starts at the Pass of the clamping step (pass it right away); reminder |
| Wrong tray / wrong person on a shared laptop | sticky bar with tray, checklist and "recording as" |
| Typo in tray designation / wrong order of processes | existing designations suggested; warning + confirmation when earlier processes are missing or not Complete |
| Process done without the reference | annotated pictures (numbered markers, "to avoid" in red), mapping table, links (DP490 TDS/SDS, datasheet, CERN HSE) |
| Problem noticed later goes unrecorded | Issues page with known problem types and usual actions; open issues shown on the tray's records |
| No one to ask | contact phone (set by root) + CERN emergency number on every page |
| Sign-off of own work | lead ≠ reviewer; only the reviewer can set Complete |
| Glue / photo / revision traceability | lot + expiry recorded, photos append-only, revisions need a reason |

## Production (CERN OpenStack VM + nginx)

Step-by-step guide: [CERN_VM_SETUP.md](CERN_VM_SETUP.md). How it is hosted and why:
[ROADMAP.md §7](ROADMAP.md#7-hosting-at-cern-how-it-runs). DEPLOY.md also covers the
Cloudflare tunnel and TrueNAS + NPMplus alternatives.

1. On the VM: `git clone` from gitlab.cern.ch, `cp .env.example .env`, set `ORIGIN` to the site's https URL.
2. `npm ci && npm run build && npm run start` — listens on 127.0.0.1:3000 only; nginx serves it over HTTPS.
3. Back up `data/` daily (`checklist.db` + `uploads/` photos: together they are the whole record) to EOS/CERNbox.

### Upgrading without touching stored data

Schema upgrades only ever add (new columns with defaults, new indexes); recorded rows are
never updated or deleted, and the database triggers refuse it anyway. Before deploying a new
version, prove it on a copy of the server database:

```
sqlite3 data/checklist.db ".backup 'tmp/check.db'"
npm run check-upgrade -- tmp/check.db      # fails if any existing row would change
```

`.env` changes for this version: `BODY_SIZE_LIMIT=20M` (photos; nginx `client_max_body_size 20m`),
optional `ROOT_USERS=<username>[,<username>]`. New tables (`roots`, `contact_history`, `issues`,
`issue_updates`) are created on start; existing rows are not touched.

**After deploying:** everyone has to log in to see anything. If `ROOT_USERS` is empty, the first
person who logs in becomes root and enters the contact phone, so log in yourself first.

## Root users

Root = created at first setup, granted by another root on the **Users & contact** page, or listed
in `ROOT_USERS`. Root sees every person's role, username, registration, session identities, open
sessions and all their entries (never password hashes), edits the contact shown on every page (each
change kept as history) and can grant root to someone else (e.g. when handing over).

## Where things are

- `src/lib/checklists/` — one folder per checklist (above), `common.js` shared fields, links, helpers
- `src/lib/server/` — database (append-only), validation, photos, Cloudflare check, exports
- `src/lib/RefImage.svelte` (annotated pictures), `PhotoUpload.svelte` + `shrink.js` (phone photos)
- `src/routes/login`, `setup` (first root + contact), `issues`, `users` (root), `photo/[file]`
- `src/routes/tray/[id]` — a record; `/history` — full log + downloads (CSV, LaTeX, printable PDF)
- `data/` — `checklist.db` and `uploads/` (not in git)
- `NEXT_STEPS.md` — current work and open questions
