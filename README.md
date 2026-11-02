# BTL Tray Checklist

Web version of `BTL_CheckLIst/main.tex`: people tick steps, every entry is logged
(name, session identity, UTC time), nothing can be deleted, changes are
revisions with a reason. See `ROADMAP.md` for the design.

## Develop

```
npm install
npm run dev          # http://localhost:5173, identity = dev@localhost
npm test             # input validation / escaping / revision tests
node scripts/smoke.mjs http://localhost:5173   # end-to-end check against the dev server (creates a test tray)
```

## Production (CERN OpenStack VM + nginx)

Step-by-step guide: [DEPLOY.md](DEPLOY.md#cern-vm-openstack--nginx). How it is hosted and why:
[ROADMAP.md §7](ROADMAP.md#7-hosting-at-cern-how-it-runs). DEPLOY.md also covers the
Cloudflare tunnel and TrueNAS + NPMplus alternatives.

1. On the VM: `git clone` from gitlab.cern.ch, `cp .env.example .env`, set `ORIGIN` to the site's https URL.
2. `npm ci && npm run build && npm run start` — listens on 127.0.0.1:3000 only; nginx serves it over HTTPS.
3. Back up `data/checklist.db` daily (it is the whole record) and keep copies on EOS/CERNbox.

## Where things are

- `src/lib/checklist.js` — steps and fields, transcribed from the .tex (edit here when the procedure changes)
- `src/lib/server/` — database (append-only), validation, Cloudflare check, exports
- `src/routes/tray/[id]` — checklist; `/history` — full log + downloads (CSV, LaTeX, printable PDF)
