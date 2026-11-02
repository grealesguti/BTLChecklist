# Deploying the BTL Tray Checklist on a server

Supported setups:

- **CERN VM (OpenStack + nginx)** — the production setup, see
  [CERN VM](#cern-vm-openstack--nginx). CERN network only, app login.
- **A. Linux server + Cloudflare tunnel** — steps 1–8 below. Cloudflare Access checks the
  `@cern.ch` email *and* people log in to the app.
- **B. TrueNAS SCALE + NPMplus** (nginx reverse proxy with a web interface) — see
  [Option B](#option-b-truenas-scale--npmplus). Only the app's own login protects it.

[What changes between the setups](#what-changes-between-setups) lists every setting that differs.
Steps marked *(once)* are only needed the first time.

## CERN VM (OpenStack + nginx)

Why it is set up this way (shared project, e-group, limits): [ROADMAP.md §7](ROADMAP.md#7-hosting-at-cern-how-it-runs).
Commands as root on the VM (AlmaLinux 9). Replace `HOSTNAME` with the VM name
(`btltestserver` for the test VM) and `GROUP/PROJECT` with the gitlab.cern.ch path.

### C1. Packages *(once)*

```
dnf module install -y nodejs:22
node -v                      # must be 22.17 or newer, else try nodejs:24
dnf install -y git sqlite nginx dnf-automatic
systemctl enable --now dnf-automatic-install.timer
```

### C2. App user and code *(once)*

```
useradd -r -m -d /opt/btl-checklist btl
sudo -u btl ssh-keygen -t ed25519 -N "" -f /opt/btl-checklist/.ssh/id_ed25519
cat /opt/btl-checklist/.ssh/id_ed25519.pub
```

Add that key on gitlab.cern.ch → project → Settings → Repository → **Deploy keys** (read-only), then:

```
sudo -u btl git clone ssh://git@gitlab.cern.ch:7999/GROUP/PROJECT.git /opt/btl-checklist/app
cd /opt/btl-checklist/app
sudo -u btl cp .env.example .env
```

In `.env` set `ORIGIN=https://HOSTNAME.cern.ch`; the other defaults are right for this setup.

```
sudo -u btl npm ci
sudo -u btl npm test
sudo -u btl npm run build
```

### C3. systemd *(once)*

`/etc/systemd/system/btl-checklist.service`:

```
[Unit]
Description=BTL Tray Checklist
After=network.target

[Service]
User=btl
WorkingDirectory=/opt/btl-checklist/app
ExecStart=/usr/bin/node --env-file=.env build
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```
systemctl daemon-reload
systemctl enable --now btl-checklist
curl -I http://127.0.0.1:3000
```

### C4. HTTPS + nginx *(once)*

Certificate: request a browser-trusted host certificate for `HOSTNAME.cern.ch` at ca.cern.ch,
save as `/etc/pki/tls/certs/HOSTNAME.crt` and `/etc/pki/tls/private/HOSTNAME.key`.
For a quick test, a self-signed one (browser warning, login still works):

```
openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj "/CN=HOSTNAME.cern.ch" -keyout /etc/pki/tls/private/HOSTNAME.key -out /etc/pki/tls/certs/HOSTNAME.crt
```

`/etc/nginx/conf.d/btl-web.conf`:

```nginx
server { listen 80; server_name HOSTNAME.cern.ch; return 301 https://$host$request_uri; }
server {
    listen 443 ssl;
    server_name HOSTNAME.cern.ch;
    ssl_certificate     /etc/pki/tls/certs/HOSTNAME.crt;
    ssl_certificate_key /etc/pki/tls/private/HOSTNAME.key;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```
setsebool -P httpd_can_network_connect 1
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
nginx -t
systemctl enable --now nginx
systemctl reload nginx
```

Also open **TCP 443** in the VM's OpenStack security group (openstack.cern.ch → Network →
Security groups → Add rule, HTTPS). firewalld and the security group are separate; both must
allow it. Limit the CIDR to CERN ranges, not `0.0.0.0/0`.

Open `https://HOSTNAME.cern.ch` from the CERN network; the first person registers with
**Register / set password**.

### C5. Backups *(once)*

`crontab -u btl -e`:

```
0 2 * * * sqlite3 /opt/btl-checklist/app/data/checklist.db ".backup '/opt/btl-checklist/backup-$(date +\%F).db'"
```

Copy them off the VM (EOS/CERNbox): OpenStack does not back up VM disks.

### C6. Updating

Back up the DB first (C5 command by hand), then:

```
cd /opt/btl-checklist/app
sudo -u btl git pull
sudo -u btl npm ci
sudo -u btl npm run build
systemctl restart btl-checklist
```

### C7. Moving to another VM

Set up the new VM with C1–C5, stop the app on both, copy `.env` and `data/checklist.db`
across, start the new one, change `ORIGIN`, nginx `server_name` and the certificate if the
hostname changed. Then delete the old VM.

---

## 1. Requirements on the server *(once)*

- Linux (any recent distribution), a user account to run the app (e.g. `btl`).
- **Node.js 22.17 or newer** (SvelteKit's minimum; the app also uses the built-in `node:sqlite`). Check with `node -v`.
  If missing or older, install it, for example with nvm:

  ```
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  # log out and back in, then:
  nvm install 22
  node -v
  ```

- `cloudflared`, if the app will be reached through a Cloudflare tunnel (see step 6).

## 2. Copy the project

Copy the project folder **without** the generated or local-only folders:
`node_modules`, `build`, `.svelte-kit`, `data`, `.env` and the `*Zone.Identifier` files.
The `Images/` folder **must** be copied, because the build needs it.

From your machine, with rsync:

```
rsync -av --exclude node_modules --exclude build --exclude .svelte-kit \
  --exclude data --exclude .env --exclude '*Zone.Identifier' \
  ./ btl@SERVER:/opt/btl-checklist/
```

(Or copy a zip of the same files with `scp` and unzip it in `/opt/btl-checklist`.)

To bring **existing records** along, copy the database separately, **with the app stopped**
on both sides so no data is left in the side files:

```
scp data/checklist.db btl@SERVER:/opt/btl-checklist/data/
```

If `data/checklist.db-wal` exists next to it, stop the app first. It then folds that file into
the database. Never copy only the `.db` while the app is running.

## 3. Configure *(once)*

On the server, in `/opt/btl-checklist`:

```
cp .env.example .env
nano .env
```

| Variable | Meaning |
|---|---|
| `HOST` | Keep `127.0.0.1`: only the tunnel on the same machine reaches the app. |
| `PORT` | Port the app listens on (default `3000`). |
| `BODY_SIZE_LIMIT` | Max form size; leave `64K`. |
| `DB_PATH` | Database file; leave `data/checklist.db` (the folder is created automatically). |
| `ORIGIN` | The public URL, e.g. `https://btl-checklist.example.org`. Without it form submissions are rejected. |
| `ACCESS_MODE` | Set to `cloudflare` for this setup (the example file has `login`). |
| `CF_ACCESS_TEAM_DOMAIN` | Uncomment. Your Zero Trust team domain, shown under Cloudflare Zero Trust → Settings: `yourteam.cloudflareaccess.com`. |
| `CF_ACCESS_AUD` | Cloudflare Zero Trust → Access → Applications → your app → *Application Audience (AUD) Tag*. |

Without the two `CF_ACCESS_*` values the production server refuses every request (403).
Only verified `@cern.ch` emails are let in.

## 4. Install, test and build

```
cd /opt/btl-checklist
npm ci            # installs exactly the versions in package-lock.json
npm test          # should end with "fail 0"
npm run build     # creates the build/ folder
```

## 5. Run

Quick manual start (stops when you log out):

```
npm run start     # loads .env, listens on http://127.0.0.1:3000
```

### Keep it running with systemd *(once)*

Create `/etc/systemd/system/btl-checklist.service` (as root). If Node came from nvm,
replace `/usr/bin/npm` with the output of `which npm`:

```
[Unit]
Description=BTL Tray Checklist
After=network.target

[Service]
User=btl
WorkingDirectory=/opt/btl-checklist
ExecStart=/usr/bin/npm run start
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then:

```
sudo systemctl daemon-reload
sudo systemctl enable --now btl-checklist
systemctl status btl-checklist        # should say "active (running)"
journalctl -u btl-checklist -f        # live logs
```

## 6. Make it reachable (Cloudflare tunnel) *(once)*

1. Cloudflare Zero Trust → Networks → Tunnels → create a tunnel and install the
   connector on the server with the command it shows.
2. Add a public hostname (e.g. `btl-checklist.example.org`) → service `http://127.0.0.1:3000`.
3. Zero Trust → Access → Applications → add a *self-hosted* application for that hostname,
   with a policy allowing emails ending in `@cern.ch`. Copy its AUD tag into `.env`
   (step 3), then `sudo systemctl restart btl-checklist`.

Open the hostname in a browser: you should get the Cloudflare login, then the checklist.

## 7. Updating to a new version

```
# from your machine: same rsync as step 2 (it never touches data/ or .env)
# on the server:
cd /opt/btl-checklist
npm ci && npm test && npm run build
sudo systemctl restart btl-checklist
```

Database changes (e.g. new columns) are applied automatically when the app starts.
Back up the database before every update (next step).

## 8. Backups

`data/checklist.db` **is** the whole record. Copy it safely while the app runs with
SQLite's backup command (install `sqlite3` if needed):

```
sqlite3 /opt/btl-checklist/data/checklist.db ".backup '/backup/checklist-$(date +%F).db'"
```

Daily, via `crontab -e` as the `btl` user (`%` must be escaped in crontab):

```
0 2 * * * sqlite3 /opt/btl-checklist/data/checklist.db ".backup '/backup/checklist-$(date +\%F).db'"
```

Keep copies off the server too, e.g. on CERNbox/EOS.

## Option B: TrueNAS SCALE + NPMplus

The app runs as a Docker image built from the project's `Dockerfile` and started from Dockge;
its source, `.env` and database live in a folder of the TrueNAS share. NPMplus, already installed on the TrueNAS, gives it a hostname and HTTPS.
Written for TrueNAS SCALE 24.10 "Electric Eel" or newer (Docker-based apps).

There is no Cloudflare Access in this setup, so **anyone who can reach the hostname sees the
login page**. Keep the hostname on the internal network / VPN, or add an NPMplus Access List
(step B5). Logged-out visitors can only read; they cannot record anything.

### B1. Where the app lives *(once)*

The app is stored in the TrueNAS share mapped on Windows as **`Z:\websites\BTLTrayInsertionChecklist`**.
Everything lives there: code, `.env`, `data/checklist.db`.

1. On TrueNAS that folder is **`/mnt/FirstVDEV/Plex_Media/websites/BTLTrayInsertionChecklist`**
   (`Z:` = `/mnt/FirstVDEV/Plex_Media`). If the share moves, **Shares → Windows (SMB) Shares**
   shows the new path; update it in B4.
2. **Datasets** → the dataset holding it → **Edit Permissions**: give user/group `apps`
   (UID/GID 568) read/write/execute on `websites/BTLTrayInsertionChecklist` (an ACL entry is
   enough; your SMB users keep their access).

### B2. Copy the project into `Z:\websites\BTLTrayInsertionChecklist`

Copies everything except the generated / local-only folders.

**From the WSL terminal** (in the project folder; the single quotes are needed in bash):

```
/mnt/c/Windows/System32/robocopy.exe '\\wsl.localhost\Ubuntu\home\guillermo\Programming\webpages\CERN\TrayInsertionChecklist' 'Z:\websites\BTLTrayInsertionChecklist' /E /XD node_modules build .svelte-kit data /XF .env '*Zone.Identifier'
```

**From Windows cmd / PowerShell** (double quotes, no single quotes):

```
robocopy "\\wsl.localhost\Ubuntu\home\guillermo\Programming\webpages\CERN\TrayInsertionChecklist" "Z:\websites\BTLTrayInsertionChecklist" /E /XD node_modules build .svelte-kit data /XF .env *Zone.Identifier
```

`robocopy` without `/MIR` never deletes anything on `Z:`, so `data\` and `.env` there are safe.
Moving existing records: copy `data\checklist.db` into `Z:\websites\BTLTrayInsertionChecklist\data\`
with the app stopped on both sides (see the note in [step 2](#2-copy-the-project)).

### B3. `.env` for this setup *(once)*

In `Z:\websites\BTLTrayInsertionChecklist`, copy `.env.example` to `.env` (e.g. in Notepad:
open, *Save as* `.env`, type *All files*) and set:

```
HOST=0.0.0.0                 # inside the container: listen on all interfaces
PORT=3000
ORIGIN=https://btl-checklist.your-domain   # the NPMplus hostname; without it forms are rejected
BODY_SIZE_LIMIT=64K
DB_PATH=data/checklist.db
ACCESS_MODE=login            # no Cloudflare: the app login is the gate
ADDRESS_HEADER=X-Forwarded-For
XFF_DEPTH=1                  # log the real client IP that NPMplus forwards
```

Remove or leave empty the `CF_ACCESS_*` lines.

### B4. Build the image and start it *(once)*

The app is built into a Docker image (`Dockerfile` in the project): install and build happen
inside Docker, not on the SMB share (which forbids `chmod`, so `npm` fails there). Only `.env`
and `data/` (the database) are used from the share.

1. Make sure the folder `Z:\websites\BTLTrayInsertionChecklist\data` exists (create it from
   Windows if not), so it gets the share's permissions.
2. TrueNAS **System → Shell** (or SSH), build the image (1–2 minutes):

   ```
   sudo docker build -t btl-checklist /mnt/FirstVDEV/Plex_Media/websites/BTLTrayInsertionChecklist
   ```

   It should end with `naming to docker.io/library/btl-checklist`.
3. **Dockge** → **+ Compose** → stack name `btl-checklist` → paste → **Deploy**
   (or Portainer **Stacks → Add stack**):

   ```yaml
   services:
     btl-checklist:
       image: btl-checklist          # built in step 2
       pull_policy: never
       user: "568:568"
       env_file: /mnt/FirstVDEV/Plex_Media/websites/BTLTrayInsertionChecklist/.env
       ports:
         - "3010:3000"               # 3010: a port no other app uses
       volumes:
         - /mnt/FirstVDEV/Plex_Media/websites/BTLTrayInsertionChecklist/data:/app/data
       restart: unless-stopped
   ```

4. The log should show `Listening on http://0.0.0.0:3000` within seconds.

- `3010` published like this is reachable from the LAN as `http://TRUENAS-IP:3010`, bypassing
  NPMplus. If NPMplus runs with **host networking**, use `"127.0.0.1:3010:3000"` and forward to
  `127.0.0.1` in B5; otherwise block 3010 from other machines (firewall/VLAN).

### B5. NPMplus proxy host *(once)*

In the NPMplus web interface → **Hosts → Proxy Hosts → Add Proxy Host**:

| Tab | Setting |
|---|---|
| Details | **Domain names**: e.g. `btl-checklist.your-domain` (must point to the TrueNAS in DNS). **Scheme** `http`, **Forward hostname / IP** `127.0.0.1` (or the TrueNAS IP, see B4), **Forward port** `3010`. Turn on **Block common exploits**. Websockets support is not needed. |
| SSL | Choose or request a certificate (Let's Encrypt needs public DNS; otherwise a custom / internal certificate). Turn on **Force SSL** and **HSTS**. |
| Access List *(recommended)* | Create one under **Access Lists** allowing only your networks (e.g. CERN / VPN ranges), and select it here. |

Leave the default forwarded headers (`Host`, `X-Forwarded-For`): the app relies on them.
HTTPS is required: the login cookie is marked *secure* and browsers drop it over plain http.

Open `https://btl-checklist.your-domain`: you should see the checklist with the login form.
The first person registers with **Register / set password**.

### B6. Updating

Snapshot the dataset first (B7), then:

1. Copy the new files to `Z:\websites\BTLTrayInsertionChecklist` (same `robocopy` as B2;
   `data\` and `.env` are never touched).
2. TrueNAS shell: rebuild the image

   ```
   sudo docker build -t btl-checklist /mnt/FirstVDEV/Plex_Media/websites/BTLTrayInsertionChecklist
   ```

3. Dockge → `btl-checklist` → **Update** (or Edit → **Deploy**): the container is recreated
   from the new image. A plain *Restart* keeps the old version.

Database changes are applied automatically when the new version starts.
A change to `.env` only needs step 3.

### B7. Backups

Add a **Data Protection → Periodic Snapshot Task** on the dataset holding
`websites/BTLTrayInsertionChecklist` (e.g. daily,
keep 30 days), plus a replication or cloud-sync task to copy it off the TrueNAS. The SQLite
database is safe to snapshot while running. To restore, roll back the dataset (or copy
`data/checklist.db` out of a snapshot) with the app stopped.

## What changes between setups

If the deployment moves, these are the only things to adjust; the code stays the same.

| Setting | A. Linux + Cloudflare | B. TrueNAS + NPMplus |
|---|---|---|
| `ACCESS_MODE` (`.env`) | `cloudflare` | `login` |
| `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` | required | not used |
| `HOST` | `127.0.0.1` | `0.0.0.0` (inside the container) |
| `ADDRESS_HEADER`, `XFF_DEPTH` | not needed | `X-Forwarded-For`, `1` |
| Started by | systemd (`npm run start`) | `docker build` + Dockge stack (B4) |
| HTTPS / hostname | Cloudflare tunnel | NPMplus proxy host + certificate |
| Who can reach the login page | only Cloudflare-verified `@cern.ch` emails | anyone who can reach the hostname (limit with NPMplus Access List / internal DNS) |
| "Email" column in logs and exports | the Cloudflare email | `ip:<client address>` |
| Backups | `sqlite3 .backup` cron (step 8) | dataset snapshots (B7) |

Also update these when they change:

- **Hostname / domain**: the DNS record and the NPMplus proxy host (B) or the tunnel's public
  hostname and the Access application (A). Nothing in `.env`.
- **Port**: `PORT` in `.env` and the port in the tunnel (A); the right-hand side of `ports:`
  in the YAML (B). In B only the left-hand port (`3010`) is what NPMplus forwards to.
- **Node version**: needs 22.17+; in B it is set in the `Dockerfile` (`node:24-alpine`), rebuild after changing it.
- **Server move**: copy the project + `.env` + `data/checklist.db` (app stopped) and follow the
  setup again; logins, people and records are all in `checklist.db`.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Every page says `Forbidden` (403) | A: `CF_ACCESS_*` missing or wrong in `.env`, the email is not `@cern.ch`, or the page was opened directly on port 3000 instead of through Cloudflare. B: `ACCESS_MODE=login` missing from `.env`. |
| Log shows `CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD not set` | A: `.env` is missing, or the app was started without `npm run start`. B: set `ACCESS_MODE=login`. |
| B: NPMplus shows `502 Bad Gateway` | App not running yet (check its logs), wrong forward host/port, or the `127.0.0.1` binding while NPMplus is not on host networking (see B4). |
| B: app logs `EACCES` / `permission denied` | `apps` (568) needs read/write on `websites/BTLTrayInsertionChecklist`, see B1. |
| B: `docker build` says `failed to read dockerfile` / `env file … not found` in Dockge | The path does not point at the folder behind `Z:\websites\BTLTrayInsertionChecklist`, or `Dockerfile` / `.env` were not copied (B1–B3). |
| B: Dockge says `pull access denied for btl-checklist` | The image was not built yet (B4 step 2), or `pull_policy: never` is missing. |
| B: `SQLITE_CANTOPEN` / `EACCES` on `data` | `data` folder missing or not writable by `apps` (568): create it from Windows (B4 step 1), check B1 permissions. |
| B: login seems to work but you stay logged out | The site was opened over `http://`; use the `https://` hostname (Force SSL in NPMplus). |
| B: every log entry shows the same IP | `ADDRESS_HEADER` / `XFF_DEPTH` missing in `.env`. |
| `No such built-in module: node:sqlite` or `EBADENGINE … current: v22.11` | Node is older than 22.17; upgrade (step 1). |
| B: `npm error EPERM … chmod`, `vite: not found`, `Resource busy 'build'` | Signs of running `npm` directly on the SMB share (old setup): use the image build of B4 instead. |
| `ExperimentalWarning: SQLite` in the log | Harmless. |
| `EADDRINUSE` | Another program uses the port: change `PORT` in `.env` and in the tunnel. |
| Images missing on step pages | `Images/` was not copied before `npm run build`; copy it and rebuild. |
