# Deploy 3X-ui on Railway

Deploy the 3X-ui panel **and** its VPN inbounds on Railway. The panel UI goes over
the generated HTTPS domain; every Xray inbound gets its own **TCP Proxy** so
clients can actually connect.

> Railway containers have no `NET_ADMIN` and no UDP. This repo's entrypoint was
> patched to disable fail2ban automatically there, and all client-facing
> inbounds use TCP-based transports. WireGuard/AmneziaWG and Hysteria (UDP)
> will not work on Railway — put those on a VPS instead.

---

## 1. Push this folder to GitHub

```bash
cd 3X-ui.3.7.0-main
git init
git add .
git commit -m "3x-ui, Railway-ready"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/3x-ui-railway.git
git push -u origin main
```

## 2. Create the Railway project

1. <https://railway.app> → sign in with GitHub.
2. **New Project** → **Deploy from GitHub repo** → pick the repo you just pushed.
3. Railway builds the Docker image (takes ~5–10 minutes the first time) and starts the panel.

## 3. Set variables

Service → **Variables** → **Raw Editor**:

```env
XUI_PORT=2053
XUI_ENABLE_FAIL2BAN=false
XUI_SKIP_HSTS=true
XUI_DB_FOLDER=/etc/x-ui
XUI_LOG_FOLDER=/var/log/x-ui
XUI_BIN_FOLDER=/app/bin
```

- `XUI_SKIP_HSTS=true` — Railway terminates TLS for you.
- A random admin password is printed in the deploy logs on first start. Change
  it in the panel right after logging in (or set it via `x-ui` CLI later).

## 4. Attach a volume (otherwise the DB is wiped on every deploy)

Service → **Settings** → **Volumes** → **Add Volume** → mount path:

```text
/etc/x-ui
```

This is where the SQLite database (`x-ui.db`) lives. Without it you lose all
inbounds and clients on every redeploy.

## 5. Generate the panel domain

Service → **Settings** → **Networking** → **Generate Domain**.

Keep the suggested port **2053**. Open the URL and log in with the credentials
from the deploy logs. **Change the admin password immediately.**

## 6. Create a TCP proxy for each inbound

The panel listens on 2053 (HTTPS via the domain). Your VPN inbounds are
separate ports that need their own public entry point:

1. In the panel create an inbound (step 7 first if you have none).
2. Railway → **Settings** → **Networking** → **TCP Proxy** → **Add**.
3. Pick the port your inbound listens on, e.g. `443`.
4. Railway assigns something like `xyz.proxy.rlwy.net:37812`. That public host
   + port is what you put into client apps and subscription links.

**One TCP proxy per inbound port.** Railway's generated host is shared by all
your proxies — the port number is what distinguishes them.

## 7. Recommended inbounds on Railway

Use TCP-based transports with TLS where possible. In the 3X-ui panel:

| Inbound | Port | Notes |
| --- | --- | --- |
| VLESS + TCP + REALITY (SNI `www.microsoft.com`) | `443` | Best default. Enable uTLS fingerprint `chrome`. |
| VLESS + WS + TLS (path `/vlessws`) | `8443` | Also works behind Cloudflare if you use your own domain. |
| Trojan + WS + TLS | `2053` | Alternative fallback. |

Avoid: anything UDP-only (Hysteria, TUIC, WireGuard, AmneziaWG, QUIC) — Railway
TCP Proxies cannot carry it. KCP/QUIC transports likewise.

**Reality settings note:** with REALITY you can leave `allowInsecure` off and
use the proxy hostname as `serverName` if you don't have a domain. If you own a
domain, point it at the TCP proxy's host via a CNAME for cleaner links.

## 8. Client setup

Use the assigned proxy address (e.g. `xyz.proxy.rlwy.net:37812`) as the server
address + port in v2rayNG / Streisand / v2rayN / Shadowrocket. If you use 3X-ui's
subscription feature, the panel URL in subscription settings must be the
**HTTPS domain** (step 5), and each inbound's listen port must match the TCP
proxy port you assigned in Railway.

## 9. Verify

- Panel loads at `https://<your-app>.up.railway.app/`.
- `Deployments` → **View Logs** shows x-ui and xray starting without fail2ban errors.
- In the panel, the inbound shows traffic counters incrementing once a client connects.
- Railway shows the TCP proxy as "healthy" once something connects.

## Costs

- Panel service + ~1GB RAM: cheapest Hobby plan covers it.
- Each TCP proxy is free.
- One Railway project can host the panel **and** act as a node itself. For
  heavier traffic or UDP protocols, add a real VPS and run the same 3X-ui
  install script there instead.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Container crashes on boot with iptables errors | Already handled — the entrypoint auto-disables fail2ban. Make sure you deployed this patched version. |
| `x-ui.db` resets after each deploy | Volume not mounted at `/etc/x-ui` (step 4). |
| Can't connect to an inbound | TCP proxy missing for that port (step 6), or the inbound binds to `127.0.0.1` instead of `0.0.0.0`. |
| TLS handshake fails | Use your own domain with a real certificate (panel SSL menu), or stick to REALITY which doesn't need a cert. |
| Subscription URL unreachable | Panel URL must be the HTTPS domain, not a TCP proxy address. |
