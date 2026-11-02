# BTL Tray Insertion Checklist — Web App Roadmap

Source of truth: `BTL_CheckLIst/main.tex` (BTL-TRAY-CHK-001, Rev. A – Draft).
Goal: people fill the checklist step by step on a server; every action is logged
(who, what, when) and the record cannot be silently altered.

---

## 0. Decisions (defaults chosen — change before Phase 1 if wrong)

| Topic | Default | Why |
|---|---|---|
| Framework | **SvelteKit** (Vite → `npm run dev`) | One project for UI + server, auto-escapes all output, built-in CSRF origin check, form actions work without JS. |
| Database | **SQLite** via Node's built-in `node:sqlite` | Single file, easy backup, plenty for a few trays/day. Move to Postgres only if several servers need to share it. |
| Hosting | **CERN OpenStack VM** (AlmaLinux 9) in a **shared project owned by an e-group**, nginx (HTTPS) → app on 127.0.0.1:3000. Code on **gitlab.cern.ch**. See §7. | Stays inside CERN, survives people leaving, reproducible from git + one DB file. |
| Access | **CERN network only** (default CERN firewall), app's own login (`ACCESS_MODE=login`). Cloudflare Access (`ACCESS_MODE=cloudflare`) kept as an alternative, not used. | No extra service needed at CERN. CERN SSO later (Phase 7). |
| Identity in the app | Users pick their name from a dropdown or add a new one (§3a). Any registered name may sign off as lead/reviewer. Every event also stores the session identity (Cloudflare email, or `ip:<client address>` in login mode). | Name = who did the work (one laptop can be shared at the tray); identity = whose session submitted it. **Later: CERN SSO**; history is kept. |
| Styling | Plain CSS with variables (light/dark), no UI framework | Fewer deps, fewer supply-chain risks. |
| Checklist definition | Hand-transcribed once into `src/lib/checklist.js` | Parsing LaTeX at runtime is fragile and an injection surface. Re-transcribe when the .tex revision changes; store the revision with each record. |

**Important:** `npm run dev` is for development only. On the server run
`npm run build && npm run start`, listening on **127.0.0.1 only**, exposed solely
through nginx with HTTPS (§7). The Vite dev server must never be exposed to the network.

---

## 1. Fix the source document first (before transcribing)

Issues found in `main.tex` that will break a step-by-step app:

- Duplicate step numbers: **06** (section 1 and 2), **26** (twice), **29** (twice).
  The completion review says "All 30 steps" — actual count is 33. Renumber.
- Step 22: "distance to be defined" — needs a value or an input field.
- Step 27 wording flagged as unresolved in the footer.
- Fastener table: service-plate roller/holder says M2.2×6 but step 08 says M2.2×5.
- "Associated manual / Associated webpage" fields are empty — the webpage URL goes here.
- Typos: "airexx", "craddle".

→ Get these confirmed by the engineering lead; the app shows whatever the
transcription says.

---

## 2. Data model

Principle: **append-only event log**. Nothing is ever UPDATEd or DELETEd; the
current state of a tray is computed from its events. That *is* the audit log.

```
people       (id, name, name_key UNIQUE, created_at)   -- name_key = lowercased, trimmed name
               (later: cern_login, role columns when SSO arrives)
trays        (id, designation UNIQUE, checklist_rev, created_by, created_at)
events       (id, tray_id, person_id, access_email, at UTC, kind, step_id, payload JSON)
               kind ∈ step_result (P/F + optional comment)
                      field_set   (tray header fields, weights, refs…)
                      person_add  (people involved, role)
                      component   (accounting row)
                      exception   (step, issue, action)
                      signoff     (lead / reviewer / status)
```

- DB triggers reject UPDATE/DELETE on `events`, `trays` and `people` (DB
  constraint, not app code). The app has **no delete/clear action at all**.
- A change = a **revision**: a new event for the same item that supersedes the
  previous one. Revisions require a **reason** (max 300 chars). The main view
  shows the latest value with a "rev. N" badge; nothing older is lost.
- People involved can't be removed; a revision can mark someone "not involved"
  (with reason) — the original entry stays in the log.
- Optional later: hash-chain each event (`hash = sha256(prev_hash + row)`) so
  tampering with the SQLite file directly is detectable.

---

## 3. Pages

1. **"Who are you?"** — name dropdown at the top of every page (§3a); remembered
   in a cookie for the session, changeable at any time. No login for now.
2. **Tray list** — designation, status (in progress / on hold / complete),
   progress bar `n/33`, last activity.
3. **New tray** — designation, roller orientation, insertion location (±Z, 0–35),
   loop/revision, commissioning test ref.
4. **Checklist** for one tray, sections 1–6 as in the .tex:
   - each step: text, links (CERNbox manuals), **Pass / Fail** buttons, comment;
     shows "✓ by J. Doe, 2026-10-19 14:32" once done.
   - Fail → automatically opens an exception entry (section 5).
   - Safety-critical steps (19, 21, 22, 25) styled as warnings; 22 and 25 need
     extra inputs (two names / scaffolding sign-off ref) before they can be passed.
   - Weights: scale 1 + scale 2, total computed server-side.
   - People involved: ≥3 required before sign-off.
   - Component accounting table.
5. **History page** (`/tray/<id>/history`, separate from the working view) —
   every entry chronologically, who / email / when, revisions marked
   ("rev. 2 — supersedes #41", reason), superseded entries greyed out.
   **All downloads live here**, not in the main view.
6. **Sign-off** — lead and reviewer (must be different people), only enabled when
   completion-review conditions are met.
7. **Export** — download buttons per tray (and "all trays" for CSV), see §3b.

Steps can be ticked in any order (reality isn't linear), but the UI highlights
the next open step. Revisit if strict order is needed.

---

## 3a. People: pick or register

- Dropdown lists every name already in the `people` table (anyone who appeared
  in any past log), sorted alphabetically.
- **"+ New person"** button opens a single text field → "Register" adds the name
  to `people` and selects it. Registering = adding a name, nothing more.
- The same picker is used wherever a name is needed: current user, "People
  involved" table, step 22 collision checkers, sign-off fields.
- Adding a person to *this* tray's "People involved" also asks for their role
  (free text, same rules as below, max 40 chars).

Name input rules (enforced **on the server**; the browser checks are only for
convenience — `maxlength`, `pattern`, `required` on the `<input>`):
- Trim, collapse repeated spaces, Unicode-normalize (NFC).
- Length 2–60 characters.
- Allowed characters only: letters (any language, e.g. é, ñ, ü), spaces,
  `.` `'` `-`. Regex: `^[\p{L}][\p{L} .'\-]{1,59}$`u. Anything else is rejected
  with a clear message — so no `<`, `>`, `"`, `&`, `/`, `=`, digits or control chars.
- Duplicates rejected case-insensitively ("john doe" = "John Doe") → the existing
  name is selected instead.
- Rate limit: max ~10 new names per IP per hour (open access → prevents spam).
- Names are only ever rendered as escaped text (Svelte default), and exported
  through the CSV/LaTeX escaping in §3b — defence in depth even though the
  allow-list already blocks markup.
- Names can't be deleted or renamed from the page (they're referenced by the
  log). Fixing a typo = admin action directly in the DB, logged.

Same validation approach for **every** free-text field in the app (comments,
references, locations, exceptions): server-side length limit (e.g. 500 chars for
comments, 100 for references/IDs), strip control characters, store as plain
text, never render as HTML. Numeric fields (kg, 0–35 location) parsed as numbers
with min/max.

---

## 3b. Exports

| Format | How | Use |
|---|---|---|
| **CSV** (Excel-ready) | Generated server-side, no library. UTF-8 with BOM so Excel shows accents correctly. Two files: `tray-<id>-log.csv` (every event: time, user, step, action, value, comment) and `all-trays-summary.csv` (one row per tray). | Excel, analysis, archiving. |
| **LaTeX (.tex)** | Fill the same layout as `main.tex` with the recorded values (☑ P/F, initials/date, fields, people, exceptions) + an appendix with the full event log. User downloads and compiles in Overleaf. | Official record in the familiar format. |
| **PDF** | A print-styled page of the record (`@media print` CSS) → browser "Save as PDF". No server dependency. | Quick PDF for CERNbox upload (step 31). |

- Real `.xlsx` (multiple sheets, formatting): skipped, CSV opens in Excel fine.
  Add `exceljs` only if someone needs sheets/formatting.
- Server-side PDF from the LaTeX (pdflatex on the server): optional later step.
  Needs TeX installed on the server; if added, compile with `-no-shell-escape`
  in a temp dir with a timeout.

Revisions in exports:
- CSV log has columns `Revision` (1 = original), `Supersedes entry #`,
  `Reason`, `Current` (yes / superseded).
- LaTeX/PDF record shows current values, items with revisions tagged
  "(rev. N)", and an appendix with the full log including superseded entries.

Export security:
- **CSV formula injection:** any cell starting with `= + - @` (or tab/CR) gets a
  leading `'` so Excel doesn't execute it as a formula.
- **LaTeX injection:** every user value is escaped (`\ { } $ & # ^ _ % ~`) before
  going into the .tex, so nobody can inject `\input{/etc/passwd}` or `\write18`.
- Exports require login and respect the same permissions as viewing the tray.

---

## 4. Security (built in from day one, not bolted on)

| Threat | Measure |
|---|---|
| HTML/script injection (XSS) | Svelte escapes everything by default; **`{@html}` banned** (lint rule). Strict CSP header: `default-src 'self'`, no inline scripts (SvelteKit `csp` config with nonces). |
| SQL injection | Prepared statements only (`db.prepare(...).run(params)`), never string-built SQL. |
| CSRF | SvelteKit `csrf.checkOrigin` (on by default) + `SameSite=Strict` cookies. |
| Cookie tampering | "Current person" cookie holds only the person id, `HttpOnly; Secure; SameSite=Strict`; server checks the id exists on every request. (Not real security while access is open — that comes with SSO.) |
| Bad input | Server-side validation of every field (§3a: allow-list for names, length limits, enums, numeric ranges e.g. 0–35, kg > 0). Client validation is cosmetic only. Request body size capped (e.g. 16 KB). |
| Unauthorized access | CERN VM: reachable only from the CERN network (CERN outer firewall, not opened in LanDB); app listens on 127.0.0.1 behind nginx; app login required to record anything. (Cloudflare mode: Access allows only `@cern.ch` emails and the app verifies the `Cf-Access-Jwt-Assertion` JWT with `jose`.) |
| Unauthorized actions | Any registered name may sign off; lead and reviewer must be different names. With SSO/roles later: per-role checks on every server action. |
| Spam / vandalism | Only `@cern.ch` users get in; every event carries the verified email, so misuse is traceable. Rate limits on writes (Cloudflare rate-limiting rule or in-app), append-only log, daily backups. |
| DoS | Not reachable from outside CERN. |
| Network exposure | firewalld: only `ssh`, `http` (redirect) and `https`. SELinux enforcing (`httpd_can_network_connect` on so nginx can reach the app). HTTPS with a CERN host certificate. Headers: `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`. |
| Dependencies | Few deps, lockfile committed, `npm audit` in CI, pin versions. |
| Server | Runs as unprivileged user `btl`, DB file not web-readable, daily DB backup (copy of SQLite file to CERNbox/EOS). Automatic security updates (`dnf-automatic`): CERN Computer Security may block unpatched hosts. |
| Errors | No stack traces to the client in production. |

---

## 5. Phases

**Phase 1 — Skeleton (½ day)**
- SvelteKit, JavaScript, `node:sqlite`, schema + triggers.
- `src/lib/checklist.js` transcribed from the fixed .tex.
- Security headers + CSP in `vite.config.js` / `hooks.server.js`.

**Phase 2 — Core checklist (1–2 days)**
- Tray list, new tray, checklist page with Pass/Fail + comment → events.
- People picker + "New person" registration with validation (§3a).

**Phase 3 — Full record (1–2 days)**
- Header fields, people involved, weights, sign-off refs, component accounting,
  exceptions, history tab.

**Phase 4 — Export & deploy on own server (1 day)**
- CSV, .tex and print-to-PDF exports (§3b) with escaping checks.
- Production build on 127.0.0.1, systemd services for the app and `cloudflared`,
  Cloudflare Access application with `@cern.ch` email policy, JWT check in
  `hooks.server.js`, backups.
- Test: direct request to the server without the tunnel/JWT → rejected;
  non-cern.ch email → blocked by Access.

**Phase 5 — Hardening & polish**
- Security review (OWASP top 10 checklist), `npm audit`, test CSP in browser,
  try injecting `<script>` / `' OR 1=1` in every field.
- Mobile/tablet layout (people will use it next to the tray), dark mode.
- Optional: hash-chained events, photo upload per step.

**Phase 6 — CERN deployment (now, see §7)**
- 6a (current): runs on `btltestserver` in a **personal** OpenStack project. Code on gitlab.cern.ch.
- 6b (required): move to a **shared** project owned by the group, so it survives anyone
  leaving (§7a). Not done until the personal VM is deleted.

**Phase 7 — CERN SSO (future)**
- CERN SSO (register app at application-portal.web.cern.ch, OIDC); link SSO accounts
  to existing `people` names so past logs stay attributed.
- Roles (operator / lead / reviewer) and per-role permission checks.
- Open to outside CERN only if needed (LanDB firewall request + security scan).

---

## 6. Open questions

1. ~~CERN SSO?~~ → CERN VM with app login, CERN network only; SSO in Phase 7.
2. ~~Who may sign off?~~ → Any registered name (lead ≠ reviewer).
3. Must steps be completed strictly in order?
4. Should the export go automatically to CERNbox, or manual download is fine?
5. Photo attachments per step needed?

---

## 7. Hosting at CERN (how it runs)

```
browser (CERN network) ──https──▶ nginx :443 ──▶ node build (127.0.0.1:3000) ──▶ data/checklist.db
                                   VM: AlmaLinux 9, shared OpenStack project
gitlab.cern.ch ──git pull (deploy key)──▶ /opt/btl-checklist/app
```

- **OpenStack project:** shared project (not personal: personal VMs expire / are deleted
  when the owner's account ends). Owner = a permanent staff member, administrators =
  e-group (e.g. `cms-btl-checklist-admins`). Check first whether CMS MTD/BTL already has
  one; otherwise request it on the CERN Service Portal ("OpenStack project request"):
  1 VM, 2 cores, 4 GB RAM, ~20 GB.
- **VM:** AlmaLinux 9, created with `--property landb-mainuser=<e-group>
  --property landb-responsible=<e-group>` so security/expiry mail reaches the team.
- **Code:** private project on gitlab.cern.ch. The VM clones it with a read-only
  deploy key as user `btl` into `/opt/btl-checklist/app`. `.env` and `data/` are not
  in git; they exist only on the VM (+ backups).
- **App:** Node 22.17+ (`dnf module install nodejs:22`), `npm ci && npm run build`,
  systemd unit `btl-checklist` (`ExecStart=/usr/bin/node --env-file=.env build`).
- **`.env`:** `ACCESS_MODE=login`, `HOST=127.0.0.1`, `ADDRESS_HEADER=X-Forwarded-For`,
  `XFF_DEPTH=1`, `ORIGIN=https://<hostname>.cern.ch` (without `ORIGIN` every form
  submission is rejected behind nginx).
- **nginx:** port 80 redirects to 443; 443 proxies to `127.0.0.1:3000` with `Host` and
  `X-Forwarded-For`. HTTPS is required (the login cookie is secure-only).
  Certificate: CERN host certificate from ca.cern.ch (must be browser-trusted).
- **System:** SELinux enforcing + `setsebool -P httpd_can_network_connect 1`;
  firewalld `https` open **and** TCP 443 in the OpenStack security group (CERN ranges only); `dnf-automatic-install.timer` for security updates;
  CERN may reboot VMs for maintenance, so nginx and the app are `systemctl enable`d.
- **Backups:** OpenStack does not back up VM disks. Daily `sqlite3 .backup` cron as
  `btl`, copies to EOS/CERNbox.
- **Update:** `git pull && npm ci && npm run build && systemctl restart btl-checklist`
  (back up the DB first; schema changes apply on start).
- **Move / rebuild:** new VM + clone + copy `.env` and `checklist.db` (app stopped).
  That is all the state there is.
- **Hostname:** chosen once for the final VM; it appears in `ORIGIN`, nginx
  `server_name` and the certificate.

### 7a. Current state and move to a group project

**Now:** the app runs on `btltestserver.cern.ch`, a VM in a **personal** OpenStack project.
That is a single point of failure: the VM belongs to one person, personal VMs have to be
renewed, and they are deleted when that person's CERN account ends, **database included**.
Until the move is done, keep the daily DB backups on EOS/CERNbox in a place the group can read.

OpenStack cannot move a VM between projects, so the move is a rebuild (the code is in git,
the only state is `.env` + `data/checklist.db`):

1. Create the e-group (egroups.cern.ch), e.g. `cms-btl-checklist-admins`: owner = a permanent
   staff member, members = current maintainers.
2. Get a shared OpenStack project: ask whether CMS MTD/BTL already has one (add the e-group
   to it), otherwise request one on the CERN Service Portal (see above).
3. Give the GitLab project to a gitlab.cern.ch **group** (not a personal namespace), with the
   e-group members as maintainers.
4. Create the new VM in the shared project with the `landb-*` properties set to the e-group,
   and set it up with DEPLOY.md "CERN VM" C1–C5.
5. Announce a short stop, stop the app on `btltestserver`, copy `.env` and
   `data/checklist.db` to the new VM, start it there, check the trays and history are all there.
6. If the hostname changes: update `ORIGIN`, nginx `server_name`, certificate, and tell users
   the new address.
7. Delete `btltestserver`. Phase 6b is done.

Hostname choice: a neutral name (e.g. `btl-checklist.cern.ch`) rather than a person or
"test" name, since it will outlive the people who set it up.
