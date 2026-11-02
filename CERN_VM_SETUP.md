# BTL Tray Checklist — new CERN OpenStack VM (group project)

Runbook to set up the checklist on a fresh VM in the **group's shared OpenStack project**,
and to move the data from the old VM. Repeat it for every new VM (replacement, OS upgrade,
move out of a personal project). Why it is hosted this way: [ROADMAP.md §7](ROADMAP.md#7-hosting-at-cern-how-it-runs).

Placeholders used below:

| Placeholder | Meaning | Example |
|---|---|---|
| `NEWHOST` | Name of the new VM (DNS name without `.cern.ch`), lowercase | `btl-checklist` |
| `OLDHOST` | VM currently running the app | `btltestserver` |
| `EGROUP` | e-group that administers the VM | `cms-btl-checklist-admins` |
| `REPO` | Git clone URL (SSH) | `git@github.com:grealesguti/BTLChecklist.git` |

Commands run **as root on the VM** unless marked otherwise.

---

## Keys and access, explained (read once)

Three different SSH key pairs are involved. Each pair = a **private** key (file without
extension, never leaves its machine, never pasted anywhere) + a **public** key (`.pub`, one
line starting `ssh-ed25519`, safe to paste into web forms).

| Key | Lives on | Public key goes to | Used for |
|---|---|---|---|
| **1. OpenStack key pair** | your PC (WSL), e.g. `~/.ssh/CERNOpenStack_2610`; copy on lxplus if you log in from there | OpenStack → Compute → **Key Pairs** (chosen when launching the VM; copied into root's `authorized_keys`) | `ssh root@NEWHOST.cern.ch` |
| **2. Your Git key** | your PC (WSL), `~/.ssh/id_ed25519` | GitHub → your profile → Settings → **SSH and GPG keys** (or gitlab.cern.ch → Preferences → SSH Keys) | `git push` from your PC |
| **3. VM deploy key** | the VM, `/opt/btl-checklist/.ssh/id_ed25519` (user `btl`) | the repository → Settings → **Deploy keys**, read-only | `git clone` / `git pull` on the VM, this repository only |

Why a deploy key: the repository is **private**, so the VM must prove it may read it. A deploy
key gives read access to one repository only, so if the VM is compromised nothing else of yours
is exposed. Never copy your own key (2) to the VM.

Create any key pair the same way (on the machine where it will live):

```
ssh-keygen -t ed25519 -C "a label, e.g. your email or the VM name"
cat ~/.ssh/id_ed25519.pub
```

Press Enter to accept the file name; a passphrase is optional for your PC, empty (`-N ""`) for
the VM so the service can pull unattended. If `~/.ssh/id_ed25519` already exists, don't
overwrite it: either reuse it or give the new one another name with `-f ~/.ssh/<name>`.

### Pushing code from your PC (private repository)

HTTPS remotes ask for a username and a **personal access token**, not your password
(GitHub → Settings → Developer settings → Personal access tokens). Easier: use SSH with key 2.

```
ssh -T git@github.com
```

Answer `yes` to the host-key question the first time. `Hi <user>! You've successfully authenticated`
means key 2 works; `Permission denied (publickey)` means it is not added to your account yet.
Then point the repository at the SSH URL and push:

```
git remote set-url origin git@github.com:grealesguti/BTLChecklist.git
git push -u origin main
```

For gitlab.cern.ch the SSH form is `ssh://git@gitlab.cern.ch:7999/<group>/<project>.git`
(test with `ssh -T -p 7999 git@gitlab.cern.ch`).

---

## 0. Before you start

- [ ] The e-group exists (egroups.cern.ch), owned by a permanent staff member.
- [ ] You are a member of the **shared** OpenStack project (not your personal one), and
      `EGROUP` is too. If not: ask the CMS MTD/BTL contact, or request a project on the CERN
      Service Portal ("OpenStack project request", 1 VM / 2 cores / 4 GB RAM / 20 GB).
- [ ] The code is pushed to `REPO` and you can add a deploy key to it.
- [ ] You have an SSH key pair registered in that OpenStack project (Key Pairs).

---

## 1. Create the VM

openstack.cern.ch → select the **shared project** (top-left) → Compute → Instances → Launch instance.

| Setting | Value |
|---|---|
| Instance name | `NEWHOST` |
| Image | `ALMA9 - x86_64` (an `aarch64` image failed with "No valid host was found") |
| Flavor | `m2.small` |
| Network | `CERN_NETWORK` |
| Key pair | your key pair |
| Security group | `btl-web` (step 2; create it first, or attach it afterwards) |

Make the e-group responsible for the machine, so security and expiry mail reach the team
(from lxplus, `openstack` CLI):

```
openstack --os-project-name "<shared project>" server set --property landb-mainuser=EGROUP --property landb-responsible=EGROUP NEWHOST
```

Wait for status **Active**, then check the name resolves (from lxplus): `getent hosts NEWHOST.cern.ch`.

## 2. OpenStack security group

A security group is OpenStack's firewall in front of the VM. It blocks everything incoming
unless a rule allows it. It is **separate** from firewalld inside the VM: a port must be
allowed in **both**. (The first test had only an HTTP rule, so https timed out in the browser
although it worked with `curl` on the VM itself.)

**Create the group** (once per project): openstack.cern.ch → Network → **Security Groups** →
**+ Create Security Group** → name `btl-web` → Create. Use a dedicated group rather than editing
`default`, which other VMs in the shared project may use.

**Add the rules**: on `btl-web` → **Manage Rules** → **+ Add Rule**, once per row:

| Rule (dropdown) | Remote | CIDR | Why |
|---|---|---|---|
| SSH | CIDR | admin source, e.g. your lxplus node `137.138.x.y/32` | log in as root |
| HTTP | CIDR | `137.138.0.0/16` (and the other IPv4 ranges below) | http → https redirect |
| HTTPS | CIDR | `137.138.0.0/16` (and the other IPv4 ranges below) | the app |
| HTTP | CIDR | `2001:1458::/32` | same, over IPv6 |
| HTTPS | CIDR | `2001:1458::/32` | same, over IPv6 |

- Leave Description empty and Direction **Ingress** (the predefined HTTP/HTTPS/SSH rules fill the
  port themselves; for "Custom TCP Rule" enter the port by hand).
- A rule is IPv4 or IPv6 depending on the CIDR you type: that's why HTTP/HTTPS appear twice.
  Forgetting the IPv6 ones = the page times out for clients that connect over IPv6.
- CERN ranges (check against current CERN network docs): IPv4 `137.138.0.0/16`,
  `128.141.0.0/16`, `128.142.0.0/16`, `188.184.0.0/15`; IPv6 `2001:1458::/32`.
  `0.0.0.0/0` (= everyone) works for a quick test but don't leave it.
- lxplus nodes change IP between logins (`hostname -I` on lxplus shows the current one). A
  `/32` SSH rule only lets that one node in; if SSH times out after a new login, add the new
  address or allow `137.138.0.0/16`.

**Attach it to the VM**: Compute → Instances → `NEWHOST` → dropdown at the right →
**Edit Security Groups** → move `btl-web` to "Instance Security Groups" → Save.
Rules apply immediately, no reboot.

## 3. Log in

With key 1 (the private key matching the OpenStack key pair chosen at launch). The SSH rule in
step 2 must allow the machine you connect from. From lxplus:

```
ssh -i ~/.ssh/<key> -o IdentitiesOnly=yes root@NEWHOST.cern.ch
```

Test first if it hangs: `nc -4 -vz -w 5 NEWHOST.cern.ch 22` (timeout = security group / network,
"Permission denied (publickey)" = wrong key).

## 4. Packages

```
dnf module install -y nodejs:22
node -v
dnf install -y git sqlite nginx dnf-automatic
systemctl enable --now dnf-automatic-install.timer
systemctl enable --now nginx
```

`node -v` must be **22.17 or newer** (else `dnf module install -y nodejs:24`).
`dnf-automatic` keeps it patched: CERN Computer Security may block unpatched hosts.

## 5. App user, deploy key, code

```
useradd -r -m -d /opt/btl-checklist btl
chown btl:btl /opt/btl-checklist
sudo -u btl mkdir -p -m 700 /opt/btl-checklist/.ssh
sudo -u btl ssh-keygen -t ed25519 -N "" -f /opt/btl-checklist/.ssh/id_ed25519
cat /opt/btl-checklist/.ssh/id_ed25519.pub
```

This is key 3 from the table above. The `mkdir` is needed: `ssh-keygen` fails if the folder is missing.
`cat` prints one line like:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI...long string... btl@NEWHOST.cern.ch
```

Copy that **whole line** (from `ssh-ed25519` to the end). Never print or copy `id_ed25519`
without `.pub`.

Add it to the repository as a deploy key:

- **GitHub:** repository page → **Settings** (repository settings, not your profile) →
  **Deploy keys** → **Add deploy key** → Title `NEWHOST`, Key = the line → leave
  "Allow write access" **unticked** → Add key.
- **gitlab.cern.ch:** project → Settings → Repository → **Deploy keys** → Add new key,
  "Grant write permissions" unticked.

Then clone **as `btl`** (as root it would use root's keys and fail with `Permission denied`):

```
sudo -u btl git clone REPO /opt/btl-checklist/app
```

Answer `yes` to the host-key question. GitHub's ED25519 fingerprint is
`SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU`.

## 6. Configure and build

```
cd /opt/btl-checklist/app
sudo -u btl cp .env.example .env
```

Edit `.env`: set `ORIGIN=https://NEWHOST.cern.ch`. The other defaults are right
(`ACCESS_MODE=login`, `HOST=127.0.0.1`, `ADDRESS_HEADER=X-Forwarded-For`, `XFF_DEPTH=1`).

```
sudo -u btl npm ci
sudo -u btl npm test
sudo -u btl npm run build
```

`npm test` must end with `fail 0` (type the command alone, no comment after it).

## 7. systemd service

```
cat > /etc/systemd/system/btl-checklist.service <<'EOF'
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
EOF
```

```
systemctl daemon-reload
systemctl enable --now btl-checklist
journalctl -u btl-checklist -n 20 --no-pager
curl -I -H 'X-Forwarded-For: 127.0.0.1' http://127.0.0.1:3000
```

The log shows `Listening on http://127.0.0.1:3000`; curl gives `200`.
A plain `curl` without the header gives `500` ("ADDRESS_HEADER … absent"): expected, nginx adds it.

## 8. Certificate, nginx, SELinux, firewalld

Certificate: request a **browser-trusted** host certificate for `NEWHOST.cern.ch` at ca.cern.ch and
save it as below. Until it arrives, a self-signed one works (browser warning, login works):

```
openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj "/CN=NEWHOST.cern.ch" -keyout /etc/pki/tls/private/NEWHOST.key -out /etc/pki/tls/certs/NEWHOST.crt
```

nginx (IPv6 `listen` lines are needed: CERN clients often connect over IPv6):

```
cat > /etc/nginx/conf.d/btl-web.conf <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name NEWHOST.cern.ch;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name NEWHOST.cern.ch;
    ssl_certificate     /etc/pki/tls/certs/NEWHOST.crt;
    ssl_certificate_key /etc/pki/tls/private/NEWHOST.key;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF
```

```
setsebool -P httpd_can_network_connect 1
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
nginx -t
systemctl reload nginx
ss -ltnp | grep nginx
curl -kI https://NEWHOST.cern.ch
```

`ss` shows `0.0.0.0:443` **and** `[::]:443`; curl gives `200` with `x-sveltekit-page: true`.

## 9. Move the data from the old VM

The whole record is `data/checklist.db` (plus `.env` for the settings). Do this in a short
announced stop; nobody may record anything on the old VM afterwards.

On **OLDHOST**:

```
systemctl stop btl-checklist
sqlite3 /opt/btl-checklist/app/data/checklist.db ".backup '/root/checklist-move.db'"
```

Copy it via lxplus (from lxplus, with your key):

```
scp -i ~/.ssh/<key> root@OLDHOST.cern.ch:/root/checklist-move.db .
scp -i ~/.ssh/<key> checklist-move.db root@NEWHOST.cern.ch:/root/
```

On **NEWHOST**:

```
systemctl stop btl-checklist
sudo -u btl mkdir -p /opt/btl-checklist/app/data
install -o btl -g btl -m 600 /root/checklist-move.db /opt/btl-checklist/app/data/checklist.db
systemctl start btl-checklist
```

Open `https://NEWHOST.cern.ch`, check the tray list and a tray's history match the old VM,
then delete `/root/checklist-move.db` on both VMs and the copy on lxplus.
(First install with no old data: skip this step; the first person registers with
**Register / set password**.)

## 10. Backups

```
crontab -u btl -e
```

```
0 2 * * * sqlite3 /opt/btl-checklist/app/data/checklist.db ".backup '/opt/btl-checklist/backup-$(date +\%F).db'"
```

OpenStack does not back up VM disks: copy the backups regularly to an EOS/CERNbox folder the
e-group can read.

## 11. Retire the old VM

- [ ] New VM checked from another computer on the CERN network (http redirects, https loads, login works).
- [ ] Users told the new address (if the hostname changed).
- [ ] Remove `OLDHOST`'s deploy key from the repository.
- [ ] Delete `OLDHOST` in OpenStack (its hostname can then be reused, after a delay).

---

## Updating the app later

See [DEPLOY.md → Redeploying after a change](DEPLOY.md#redeploying-after-a-change)
(push from your PC, back up, pull and rebuild as `btl`, check, roll back if needed).

## Troubleshooting (seen during the first setup)

| Symptom | Cause / fix |
|---|---|
| `sudo: unknown user btl` | Step 5 `useradd` not run. |
| `ssh-keygen`: saving key failed | `/opt/btl-checklist/.ssh` missing: run the `mkdir` in step 5. |
| `git clone`: `Permission denied (publickey)` | Deploy key not added, or cloned as root instead of `sudo -u btl`. |
| `git pull`: "detected dubious ownership" | Ran git as root. Use `sudo -u btl git pull`; don't add `safe.directory`. |
| Folder empty after clone | Code not pushed to `REPO` yet; push, then `sudo -u btl git -C /opt/btl-checklist/app pull`. |
| `npm test`: "Could not find …" | Extra words were pasted after `npm test`. |
| `curl` right after start: connection refused | App still starting; retry after a second. |
| Direct `curl` to :3000 gives 500 "ADDRESS_HEADER … absent" | Normal without nginx; add `-H 'X-Forwarded-For: 127.0.0.1'`. |
| Browser shows an old static test page | `btl-web.conf` still has `root …`; replace it (step 8) and reload nginx. |
| Works with `curl` on the VM, browser times out | Security group lacks 443 (or the IPv6 rule), or nginx lacks `listen [::]:443` (step 8). |
| `502 Bad Gateway` | App not running (`systemctl status btl-checklist`) or `httpd_can_network_connect` off. |
| Login works but you stay logged out / forms rejected | Opened over `http://`, or `ORIGIN` in `.env` doesn't match the address in the browser. |
| `No such built-in module: node:sqlite` | Node older than 22.17 (step 4). |
