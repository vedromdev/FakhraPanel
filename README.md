# Azadi Panel

A multi-protocol VPN management panel — control plane deployed on Railway, with agents on each VPN server (Railway region or any VPS) forming a unified mesh.

## Features

| # | Feature | Status |
|---|---------|--------|
| 1 | Multiple VPN types | ✅ VLESS, VMess, Hysteria2, Shadowsocks, Trojan, TUIC, WireGuard |
| 2 | VLESS / V2Ray / Hysteria | ✅ Primary protocols, Reality + Vision flow |
| 3 | Railway deployment | ✅ Panel on Railway + Railway region nodes |
| 4 | Modern animated UI | ✅ Tailwind + Framer Motion + aurora bg |
| 5 | Project location | ✅ `/Desktop/Azadi-Panel` |
| 6 | Animations & cursor | ✅ Custom animated cursor + sparks, typewriter, aurora, glass cards |
| 7 | Name: azadi-panel | ✅ |
| 8 | Multi-location mesh | ✅ Agents connect via outbound WSS → panel pushes mesh configs |

## Architecture

```
                    ┌──────────────────────────────────────────┐
                    │     AZADI PANEL (Railway service #1)     │
                    │   Fastify API + React SPA + SQLite DB     │
                    │   /api · /agent/control (WSS) · /sub      │
                    └─────────────┬──────┬──────┬───────────────┘
                                  │      │      │  outbound control-channel (WSS over HTTPS edge)
                   ┌──────────────┘      │      └──────────────┐
                   ▼                     ▼                     ▼
       ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
       │ AGENT — Railway  │  │ AGENT — Railway  │  │ AGENT — Any VPS  │
       │ us-east region   │  │ eu-west region   │  │ Tokyo / Frankfurt│
       │ xray ws-only     │  │ xray ws-only     │  │ xray+hy2+wg+ss   │
       │ (edge forwards  │  │ (edge forwards  │  │ (full ports)     │
       │  only HTTP/WS)  │  │  only HTTP/WS)  │  │                  │
       └──────────────────┘  └──────────────────┘  └────────┬───────┘
                                                             │ WireGuard mesh 10.77.x.0/24
                                                             └────────┬────────┘
                                                                      │
                                                        Traffic chains: any→any node
```

**Why this works on Railway:** Railway's edge only forwards HTTP/WebSocket (and terminates TLS at the edge) — it cannot bind raw TCP/UDP/QUIC ports. The panel and agents run as *separate Railway services*, and each agent maintains an **outbound** WebSocket control channel to the panel. So even though Railway blocks inbound UDP/QUIC:

- ✅ VLESS / VMess / Trojan over WS+TLS — works on Railway (edge forwards WebSocket)
- 🟡 Hysteria2 / TUIC / raw-VLESS-Reality — only on **VPS** nodes (need raw UDP/QUIC)
- ✅ ShadowSocks + WireGuard mesh — works on VPS or via relayed ports on Railway
- ✅ **Multi-location mesh** — every location is a node; WireGuard (10.77.x.0/24) stitches them into one network, and the panel pushes configs so traffic can chain: client → node A → node B

The agent (`backend/agent.js`) is a lightweight Node.js process. It connects **outbound** to the panel over WebSocket, receives its xray/hysteria2/wireguard config automatically, and reports real-time stats. Add a new Railway region service or a VPS in any country → it appears live in the panel instantly.

## Quick Start (local)

```bash
# 1. Start the panel
cd backend
export ADMIN_PASS=admin123
export AGENT_SHARED_SECRET=dev-secret
export DB_PATH=./data/azadi.db
node src/index.js

# 2. Open http://localhost:3000 → login: admin / admin123

# 3. (Optional) Start a local agent pointed at the panel
export AZADI_PANEL=http://localhost:3000
export AZADI_SECRET=dev-secret
node ../agent.js
```

## Deploy to Railway

```bash
railway login
railway init
railway variables set ADMIN_USER=admin ADMIN_PASS=<secret> \
  AGENT_SHARED_SECRET=<shared-across-nodes> DB_PATH=./data/azadi.db
railway up
```

For multi-location: add a **new Railway service** (or deploy to a VPS in any country) with:
- `AZADI_PANEL` → your panel's URL
- `AZADI_SECRET` → the shared secret from the panel's `AGENT_SHARED_SECRET` setting
- `NODE_NAME`, `FLAG`, `COUNTRY` (optional labels)
- `RAILWAY_PUBLIC_DOMAIN` auto-set by Railway (marks this as a ws-only-capable node)

The panel auto-discovers all agents and meshes them into a single 10.77.x.0/24 network.

Full deployment guide: [DEPLOY.md](./DEPLOY.md)

## Project Structure

```
├─ backend/
│  ├─ agent.js                 # Agent: runs on each VPN server, connects outbound to panel
│  ├─ Dockerfile.agent         # Agent-only image for VPS/railway nodes
│  ├─ package.json
│  ├─ src/
│  │  ├─ db.js                 # SQLite schema (nodes, users, assignments, traffic, sessions)
│  │  ├─ index.js              # Panel API (Fastify): /api, /agent/control (WSS), /sub
│  │  ├─ protocols.js          # VLESS/VMess/HY2/SS/Trojan/Tuic/WG config builder + links
│  │  ├─ configgen.js          # xray/hysteria/wireguard-mesh config generators
│  │  └─ services/
│  │     └─ node-manager.js    # Agent connection registry + config push
├── frontend/
│  ├─ index.html
│  ├─ vite.config.js
│  ├─ tailwind.config.js
│  ├─ postcss.config.js
│  ├─ package.json
│  └─ src/
│     ├─ main.jsx              # React entry (Router + Query + Auth)
│     ├─ App.jsx               # Route layout with auth guard
│     ├─ index.css             # Aurora bg + dark glass theme
│     ├─ components/
│     │  ├─ Cursor.jsx          # Custom animated cursor w/ click sparks
│     │  ├─ HeroTypewriter.jsx  # Animated gradient typewriter
│     │  ├─ Sidebar.jsx
│     │  ├─ ui.jsx              # Aurora, glass cards, modal, toast, stat cards
│     ├─ contexts/AuthContext.jsx
│     └─ pages/
│        ├─ Login.jsx          # Animated login with gradient text
│        ├─ Dashboard.jsx      # Live stats via dashboard WS + node status
│        ├─ Nodes.jsx          # Add/deploy/delete nodes
│        ├─ Users.jsx          # User mgmt + multi-location node assignment
│        ├─ Protocols.jsx      # Protocol comparison table
│        └─ Settings.jsx
├─ Dockerfile                   # Multi-stage: frontend build → panel image
├─ docker-compose.yml           # Local: panel + agent
├─ railway.json                 # Railway config
├─ DEPLOY.md
├─ .env.agent.example
└─ README.md
```

## API Endpoints

### Auth & Control
- `POST /api/login` — admin login, returns session token

### Nodes (admin)
- `GET /api/nodes` — list all registered agents
- `POST /api/nodes` — register a node manually
- `POST /api/nodes/:id/deploy` — push config to agent immediately
- `PUT /api/nodes/:id` / `DELETE /api/nodes/:id`

### Users (admin)
- `GET /api/users` — list with usage stats
- `POST /api/users` — create + assign to specific nodes (multi-location targeting)
- `PUT /api/users/:id` — toggle/enabled/limits / reassign nodes

### Client-facing
- `GET /sub/:token` — subscription endpoint (base64 of all shareable links)

### Agent
- `WS /agent/control` — WebSocket control channel (agent connects outbound here)

## License

MIT
