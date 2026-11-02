# CERN OpenStack VM Setup Guide

Reusable procedure based on deploying `BTLTestServer.cern.ch` with AlmaLinux 9, Nginx, and SSH through lxplus.

## 1. Create the VM

Open [CERN OpenStack Horizon](https://openstack.cern.ch/) → **Proyecto → Computación → Instancias → Lanzar instancia**.

| Setting | Example |
|---|---|
| Instance name | `BTLTestServer` |
| Image | `ALMA9 - x86_64` |
| Flavor | `m2.small` |
| Availability zone | `cern-geneva-b` |
| Network | `CERN_NETWORK` |
| SSH key pair | `test_claves` |

An earlier attempt with `ALMA10 - aarch64` failed with `No valid host was found`; switching to an x86_64 image worked in this case. Wait for **Active** status and a login prompt in the console log.

Reference: [CERN VM creation tutorial](https://clouddocs.web.cern.ch/tutorial_using_a_browser/create_a_virtual_machine.html).

## 2. Record network details

Example VM:

- Hostname: `BTLTestServer.cern.ch`
- IPv4: `188.185.23.154`
- IPv6: `2001:1458:d00:66::100:396`

Verify **Instancias → BTLTestServer → Interfaces** reports **Activo / ARRIBA**.

From lxplus:

```bash
getent hosts BTLTestServer.cern.ch
```

## 3. Configure SSH access in the OpenStack security group

Go to **Proyecto → Red → Grupos de seguridad → default → Administrar reglas → Agregar regla**.

Add an inbound **SSH** rule with **Remoto: CIDR**, limited to your authorized source IPv4 address plus `/32`.

On lxplus, obtain its IPv4 address:

```bash
hostname -I
```

For example, `lxplus994` had `137.138.158.40`, so the rule used `137.138.158.40/32`.

**Important:** Logging into `lxplus.cern.ch` may assign a different lxplus host with a different IP. An individual `/32` rule only permits that address. For a long-term solution, use CERN-approved ranges or a stable administrative access mechanism. Prefer a dedicated security group over modifying `default` if other VMs use it.

## 4. Verify network connectivity before troubleshooting keys

From lxplus:

```bash
nc -4 -vz -w 5 BTLTestServer.cern.ch 22
```

Expected: `Ncat: Connected to ...:22`.

| Result | Interpretation |
|---|---|
| `TIMEOUT` | Likely firewall or network access issue |
| `Connection refused` | Host reachable, but SSH not accepting connections |
| `Connected` | TCP connectivity works; proceed to authentication |
| `Permission denied (publickey)` | SSH is reachable, but key authentication failed |

## 5. Authenticate using the correct SSH key

The OpenStack key pair was `test_claves`, with its corresponding private key originally stored in WSL as `~/.ssh/CERNOpenStack_2610`.

If CERN policy permits copying private keys to lxplus, from WSL:

```bash
ssh greales@lxplus.cern.ch 'mkdir -p ~/.ssh && chmod 700 ~/.ssh'
scp ~/.ssh/CERNOpenStack_2610 greales@lxplus.cern.ch:~/.ssh/CERNOpenStack_2610
```

On lxplus:

```bash
chmod 600 ~/.ssh/CERNOpenStack_2610
ssh -i ~/.ssh/CERNOpenStack_2610 -o IdentitiesOnly=yes root@BTLTestServer.cern.ch
```

A successful login displays a prompt such as `[root@btltestserver ~]#`.

**Security:** Agent forwarding or an approved key-management method avoids storing another copy of the private key on lxplus. Never put a private key in a public directory or Git repository.

## 6. Install Nginx

On the VM:

```bash
dnf install -y nginx
systemctl enable --now nginx
systemctl status nginx --no-pager
```

## 7. Create a separate website project directory

```bash
mkdir -p /srv/btl-web/{site/css,site/js,site/images,site/assets,config}
chmod 755 /srv/btl-web /srv/btl-web/site
```

Directory layout:

```text
/srv/btl-web/
├── site/
│   ├── index.html
│   ├── css/
│   ├── js/
│   ├── images/
│   └── assets/
└── config/
```

## 8. Configure Nginx

Create `/etc/nginx/conf.d/btl-web.conf`:

```nginx
server {
    listen 80;
    server_name btltestserver.cern.ch;

    root /srv/btl-web/site;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

Create a test page:

```bash
cat > /srv/btl-web/site/index.html <<'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>BTL Web</title>
</head>
<body>
    <h1>BTL Web</h1>
    <p>Internal CERN project website.</p>
</body>
</html>
HTML
```

## 9. Set SELinux contexts

Because the site is in `/srv`, label it for Nginx:

```bash
dnf install -y policycoreutils-python-utils
semanage fcontext -a -t httpd_sys_content_t '/srv/btl-web/site(/.*)?'
restorecon -RFv /srv/btl-web/site
```

The `semanage fcontext -a` command is a one-time registration for a new path. If the rule already exists, modify it rather than adding a duplicate.

Validate:

```bash
nginx -t
systemctl reload nginx
curl -I -H 'Host: btltestserver.cern.ch' http://127.0.0.1/
```

Expected: `HTTP/1.1 200 OK` with a response corresponding to your own `index.html` (not the packaged Nginx default page).

## 10. Open HTTP in AlmaLinux firewalld

```bash
systemctl is-active firewalld
firewall-cmd --permanent --add-service=http
firewall-cmd --reload
```

Only run the `firewall-cmd` commands when firewalld is active. This firewall is **separate** from OpenStack security groups.

## 11. Permit web access in OpenStack

In the security group attached to the VM, add an inbound **HTTP** rule (TCP port 80).

For a temporary public test, the CIDR `0.0.0.0/0` was used. This permits connections from **any IPv4 address**, not only CERN. Use it only for non-sensitive test content; prefer approved CERN network ranges or HTTPS plus authentication for real use.

Test in a browser:

[http://btltestserver.cern.ch/](http://btltestserver.cern.ch/)

On Windows, if it times out:

```powershell
Test-NetConnection btltestserver.cern.ch -Port 80
```

## 12. Prepare for Git-based deployments

Suggested repository layout:

```text
btl-web/
├── README.md
├── .gitignore
├── site/
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── images/
└── deploy/
```

To deploy a repository whose website is under `site/`:

```bash
git clone <repository-url> /srv/btl-web-source
rsync -av /srv/btl-web-source/site/ /srv/btl-web/site/
restorecon -RF /srv/btl-web/site
```

Do not commit passwords, private keys, TLS keys, or other secrets. Use `rsync --delete` only if you intentionally want to remove files absent from the repository.

## Verification checklist

- [ ] VM is Active and interface is UP
- [ ] DNS resolves to the VM
- [ ] SSH ingress permits the authorized source
- [ ] Port 22 is reachable
- [ ] SSH authentication works with the matching key
- [ ] Nginx is active
- [ ] Website exists under `/srv/btl-web/site/`
- [ ] SELinux contexts are correct
- [ ] HTTP/HTTPS is permitted by firewalld
- [ ] HTTP/HTTPS ingress is permitted by OpenStack
- [ ] Website opens from another computer
- [ ] HTTPS and authentication are in place before sensitive content is published

## Remaining security work

The tested configuration is a functional HTTP prototype, **not a finished secure deployment**. Before publishing internal CERN information:

1. Obtain and configure a valid TLS certificate for `btltestserver.cern.ch`.
2. Enable HTTPS (TCP 443) in both firewalld and the OpenStack security group.
3. Integrate CERN SSO or another CERN-approved authentication gateway; do not build a plain-HTTP password form.
4. Restrict access to authorized users or approved CERN network ranges.
5. Keep SSH limited to authorized administration sources.
6. Apply security updates, back up configuration, and use a non-root deployment account where practical.
