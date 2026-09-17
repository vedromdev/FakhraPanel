# Fakhra Panel

Fakhra Panel is a fresh, Railway-ready Node.js VPN control panel project. The package name is `azadi-panel`, while the visible product name in the UI is **Fakhra Panel**.

It is designed as a control plane: Railway hosts the web panel, API, health endpoint, node registry, client profiles, and generated subscription/config links. Your actual VPN protocol servers should run on VPS or edge nodes that support the required protocols, then register in the panel as nodes.

## Features

- Railway compatible with `npm start` and `/api/health`.
- No required npm dependencies.
- Protocol templates for VLESS, VMess/V2Ray, Hysteria 2, Trojan, Shadowsocks, WireGuard, TUIC, NaiveProxy, and AnyTLS.
- Multi-location node grouping and automatic route preview.
- Node compatibility model for connecting multiple server locations into one panel.
- Client profile creation with generated UUIDs and subscription links.
- API token protection for write operations.
- Animated dashboard UI with custom cursor, moving background, live metrics, and responsive layout.

## Run locally

```bash
npm start
```

Open `http://localhost:3000`.

Default login:

- Username: `admin`
- Password: `azadi-admin`

Change these in Railway variables:

- `PANEL_USER`
- `PANEL_PASSWORD`
- `PANEL_TOKEN`

## Railway deploy

1. Push this project to a Git repository.
2. Create a Railway project from the repository.
3. Add environment variables:
   - `PANEL_USER`
   - `PANEL_PASSWORD`
   - `PANEL_TOKEN`
4. Deploy.
5. Railway will run `npm start` and check `/api/health`.

## Important architecture note

Railway is excellent for the web panel, API, and orchestration layer. Most VPN protocols need raw networking, UDP, tun/tap, custom ports, or long-running native services. Those protocol daemons should run on your own nodes. Fakhra Panel tracks those nodes, groups them by location, generates links/configs, and exposes a node registration API for multi-location management.

## Node registration

Register a node from any server:

```bash
curl -X POST https://YOUR-RAILWAY-DOMAIN/api/nodes/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PANEL_TOKEN" \
  -d '{
    "name": "Germany Edge 1",
    "location": "Frankfurt",
    "region": "eu-central",
    "host": "de.example.com",
    "protocols": ["vless", "hysteria2", "vmess"],
    "ports": { "vless": 443, "hysteria2": 443, "vmess": 8443 },
    "status": "online"
  }'
```

## API highlights

- `GET /api/health`
- `GET /api/bootstrap`
- `POST /api/login`
- `GET /api/nodes`
- `POST /api/nodes`
- `POST /api/nodes/register`
- `GET /api/clients`
- `POST /api/clients`
- `GET /api/routes`
- `POST /api/routes`
- `GET /sub/:clientId`

## Security

This project starts with simple panel authentication and bearer-token API protection. Before putting real users on it, place it behind HTTPS, set strong environment secrets, add persistent managed storage, and connect real node-side provisioning scripts for the protocols you use.
