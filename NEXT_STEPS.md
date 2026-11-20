# Work in progress / next steps (updated 2026-11-19)

Kept up to date so work can be resumed after a crash. See README.md for how the app works.

## Done (tests 18/18, smoke test on a fresh DB, build, upgrade check on a copy of the real DB)
- Several checklists, one folder each in `src/lib/checklists/<id>/` (checklist.js, images/, docs/).
- Process chain per tray (`CHAIN`): sensor gluing → preheater gluing → pipe clamp & preheater assembly
  → tray insertion (last, before commissioning). Warnings on records and home list; confirmation needed
  to start a process whose earlier ones are missing / not Complete.
- Sensor gluing rewritten from the pptx manual + photos; preheater gluing with photos; new pipe clamp &
  preheater assembly checklist. Clamp mapping 1A/1B/2A/2B transcribed from the printed sheet (TO VERIFY).
- Annotated reference pictures (captions, numbered markers + legend, TO AVOID frames, cross-checklist reuse).
- Reference images downsized to ≤1280 px (originals in tmp/original-images/, not in git).
- Phone: responsive layout, camera upload, browser-side shrink to ≤1600 px JPEG, server limit 4 MB/photo,
  automatic photo names, missing photo = warning (not a block).
- Login required everywhere; first logged-in user sets up root + contact phone; root edits contact
  (history kept) and grants root; contact + CERN emergency 74444 in every page footer.
- Issues page for problems found later (known types per process, photos, status updates), open issues
  shown on records.
- Human-error guards: strict order (gluing), second checks, PT1000 / resistor range alarms, expiry,
  cure timers, record bar, only reviewer completes.

## To check in a browser (not done by Claude)
- Look at the pages on a phone: marker positions on the pictures (estimated from the photos), camera
  upload + shrinking (iPhone HEIC → JPEG), layout.

- Manual converted to PDF (sensor/docs/…pdf, LibreOffice); pages 2–5 used as step pictures; clamp mapping
  table confirmed against page 2. Glue-gun step 05b: superglued 1.3 mm tip on the mixing nozzle (pull test),
  single-use nozzles, components never mixed before the nozzle, enough glue + spare cartridge.

## Waiting on the user
- Resistor part number (read "221 30 / 3300 1%" = Bourns PWR221T-30, 330 Ω) and range (320–340 Ω set).
- Overnight cure minimum (12 h assumed).
- Confirm IPA cleaning steps; which tray steps need a second check (04, 13c, 19, 22 now).
- Screw sizes for the pipe clamp assembly (photo names M2×10 / M2×16) vs tray step 07 (M2.2×10 / M2.2×14).
- Marker positions / which clamp is 1A/1B/2A/2B on the photos (only certain markers were added).

## Deploying this version
See README "Upgrading without touching stored data" and CERN_VM_SETUP.md §10a: back up, run
`npm run check-upgrade` on a copy, set BODY_SIZE_LIMIT=20M + nginx client_max_body_size 20m, log in
first yourself (you become root and set the contact phone).
