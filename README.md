# Fakhra Panel

**Fakhra Panel** is a Railway-ready VPN control panel. The package name is `azadi-panel`, while the visible app name is **Fakhra Panel**.

The panel is designed as a **control plane**:

- Railway runs the web dashboard, API, health check, clients, nodes, routes, and subscription/config generation.
- Your real VPN servers run on VPS/edge nodes.
- The panel connects those nodes into one multi-location dashboard.

> Important: Railway is great for the panel. It is usually not the right place to run raw VPN protocol daemons directly because many VPN protocols need UDP, custom ports, tun/tap, or system-level networking.

## Features

- Railway deploy support with `npm start`.
- Automatic Railway port support through `process.env.PORT`.
- Local fallback port: `3000`.
- Health endpoint: `/api/health`.
- Clean tabbed dashboard UI.
- Icons, protocol badges, animated overview, custom cursor, responsive layout.
- Node registry for multi-location setups.
- Client profiles with generated UUIDs.
- Subscription endpoint for clients.
- Protocol profiles for:
  - VLESS
  - VMess / V2Ray
  - Hysteria 2
  - Trojan
  - Shadowsocks
  - WireGuard
  - TUIC
  - NaiveProxy
  - AnyTLS
- Xray Core config generation for:
  - VLESS
  - VMess
  - Trojan
  - Shadowsocks
- Copyable Xray Core install/bootstrap script for VPS nodes.
- API token protection for node registration and protected config generation.

## Requirements

You need:

- Node.js 18 or newer
- npm
- A Railway account
- A GitHub account
- Optional but recommended: one or more VPS servers for real VPN nodes

No npm packages are required. This project uses Node.js built-in modules only.

## Project Structure

```text
.
├── server.js
├── package.json
├── railway.json
├── README.md
├── data
│   ├── .gitkeep
│   └── state.json
└── public
    ├── index.html
    ├── styles.css
    └── app.js
```

## Run Locally

Open a terminal:

```bash
cd /Users/arshanabdollahi/Desktop/Azadi-Panel
npm start
```

Open:

```text
http://localhost:3000
```

Default login:

```text
Username: admin
Password: azadi-admin
```

If port `3000` is already busy, run on another port:

```bash
PORT=3107 npm start
```

Then open:

```text
http://localhost:3107
```

## Environment Variables

Set these in Railway:

```env
PANEL_USER=admin
PANEL_PASSWORD=change-this-password
PANEL_TOKEN=change-this-long-random-token
```

What they do:

| Variable | Purpose |
| --- | --- |
| `PANEL_USER` | Admin username for the web panel |
| `PANEL_PASSWORD` | Admin password for the web panel |
| `PANEL_TOKEN` | Bearer token used by nodes and protected config endpoints |
| `PORT` | Automatically provided by Railway. Do not set this manually unless running locally. |

## Railway Deployment

### 1. Push to GitHub

From the project folder:

```bash
git init
git add .
git commit -m "Initial Fakhra Panel"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. Create a Railway Project

Go to:

```text
https://railway.app
```

Then:

```text
New Project -> Deploy from GitHub repo
```

Select your Fakhra Panel repository.

### 3. Confirm Railway Settings

Railway should use:

```text
Start command: npm start
Health check: /api/health
```

These are also included in `railway.json`.

### 4. Add Variables

In Railway:

```text
Service -> Variables
```

Add:

```env
PANEL_USER=admin
PANEL_PASSWORD=your-strong-password
PANEL_TOKEN=your-long-secret-token
```

### 5. Generate a Domain

In Railway:

```text
Service -> Settings -> Networking -> Generate Domain
```

You will get a URL like:

```text
https://your-app.up.railway.app
```

Open it and log in with your panel username and password.

## Ports

For the panel:

| Place | Port |
| --- | --- |
| Local default | `3000` |
| Local custom | Example: `PORT=3107 npm start` |
| Railway | Automatically assigned through `process.env.PORT` |

Do **not** hard-code a port for Railway.

For real VPN nodes, typical ports are:

| Protocol | Recommended Port |
| --- | --- |
| VLESS | `443` |
| VMess / V2Ray | `443` or `8443` |
| Trojan | `443` |
| Hysteria 2 | `443/UDP` |
| Shadowsocks | `8388` |
| WireGuard | `51820/UDP` |
| TUIC | `443/UDP` |
| NaiveProxy | `443` |
| AnyTLS | `443` |

## Register a Node

Use this from a VPS or server that you want to add as a node:

```bash
curl -X POST https://YOUR-RAILWAY-DOMAIN/api/nodes/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PANEL_TOKEN" \
  -d '{
    "name": "Germany Edge 1",
    "location": "Frankfurt",
    "region": "eu-central",
    "host": "de.example.com",
    "protocols": ["vless", "vmess", "trojan", "shadowsocks", "hysteria2"],
    "ports": {
      "vless": 443,
      "vmess": 8443,
      "trojan": 443,
      "shadowsocks": 8388,
      "hysteria2": 443
    },
    "status": "online",
    "xrayVersion": "latest"
  }'
```

Replace:

- `YOUR-RAILWAY-DOMAIN` with your Railway app URL.
- `YOUR_PANEL_TOKEN` with your Railway `PANEL_TOKEN`.
- `host` with your node server domain or IP.

## Xray Core Setup

Fakhra Panel can generate Xray Core configs for:

- VLESS
- VMess
- Trojan
- Shadowsocks

### Option A: Use the Dashboard

1. Open the panel.
2. Log in.
3. Go to the **Xray Core** tab.
4. Select a node.
5. Select a client.
6. Copy `config.json` or the install script.

### Option B: Download Config by API

Get a full response with metadata:

```bash
curl https://YOUR-RAILWAY-DOMAIN/api/xray/config \
  -H "Authorization: Bearer YOUR_PANEL_TOKEN"
```

Get raw `config.json` only:

```bash
curl "https://YOUR-RAILWAY-DOMAIN/api/xray/config?raw=1" \
  -H "Authorization: Bearer YOUR_PANEL_TOKEN" \
  -o config.json
```

### Option C: Use the Install Script

On your VPS:

```bash
export PANEL_URL="https://YOUR-RAILWAY-DOMAIN"
export PANEL_TOKEN="YOUR_PANEL_TOKEN"
```

Then copy the install script from the **Xray Core** tab and run it as root.

The script will:

1. Install required packages.
2. Install Xray Core.
3. Download the generated Xray config from your panel.
4. Enable and restart the `xray` service.

## Client Subscription Links

Each client has a subscription URL:

```text
https://YOUR-RAILWAY-DOMAIN/sub/CLIENT_ID
```

In the dashboard:

1. Go to **Clients**.
2. Click **Sub**.
3. Paste the copied subscription URL into a compatible VPN client.

## API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check for Railway |
| `GET` | `/api/bootstrap` | Panel bootstrap data |
| `POST` | `/api/login` | Login and get a session token |
| `GET` | `/api/protocols` | Supported protocols |
| `GET` | `/api/nodes` | List nodes |
| `POST` | `/api/nodes` | Add node |
| `POST` | `/api/nodes/register` | Register/update node |
| `GET` | `/api/clients` | List clients |
| `POST` | `/api/clients` | Create client |
| `GET` | `/api/routes` | Route preview |
| `POST` | `/api/routes` | Create route |
| `GET` | `/api/xray/templates` | Xray support info |
| `GET` | `/api/xray/config` | Generate Xray config |
| `GET` | `/api/xray/config?raw=1` | Generate raw Xray config |
| `GET` | `/api/xray/install-script` | Generate VPS install script |
| `GET` | `/sub/:clientId` | Client subscription |

## Security Notes

Before using this for real traffic:

1. Change the default panel password.
2. Use a long random `PANEL_TOKEN`.
3. Keep your Railway variables secret.
4. Use HTTPS domains for panel and nodes.
5. Put TLS/reverse proxy configuration in front of Xray WebSocket inbounds.
6. Use a persistent database or volume if you need long-term production storage.
7. Rotate any token that is accidentally shared.

## Troubleshooting

### `npm error Missing script: "start"`

You are probably in the wrong folder. Run:

```bash
cd /Users/arshanabdollahi/Desktop/Azadi-Panel
npm run
```

You should see:

```text
start
  node server.js
```

### Port 3000 is busy

Run:

```bash
PORT=3107 npm start
```

### Railway deploy fails

Check:

- `package.json` exists.
- `package.json` has `"start": "node server.js"`.
- Railway variables are set.
- Health check path is `/api/health`.

### Xray script cannot download config

Check:

- `PANEL_URL` is set on the VPS.
- `PANEL_TOKEN` matches Railway.
- The node exists in the panel.
- The panel URL is reachable from the VPS.
