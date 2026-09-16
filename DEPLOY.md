# Azadi Panel — one repo, two deployable artifacts.
# Panel  = Railway service #1 (control plane + frontend)
# Agent  = Railway service #2/N or any VPS   (runs xray/hysteria2/wireguard-mesh)

# ── PANEL DEPLOY (Railway) ──────────────────
# 1. Connect this repo's root to Railway.
# 2. Set env vars (Dashboard → Settings → Variables):
#    DATABASE_URL          (SQLite used locally; set PostgreSQL URL for production)
#    ADMIN_USER             admin
#    ADMIN_PASS             <change this>
#    AGENT_SHARED_SECRET    <generate one — shared with all agents>
#    PORT                   3000
# 3. Deploy: railway up --detach

# ── NODE DEPLOY (Railway region or VPS) ──────
# Option A — Railway (Railway region service, same project):
#   In Railway, add a service → "Deploy from Dockerfile" → path: backend/Dockerfile.agent
#   Env vars:
#     AZADI_PANEL            https://<your-panel>.up.railway.app
#     AZADI_SECRET           <the AGENT_SHARED_SECRET from the panel>
#     NODE_NAME              Berlin
#     FLAG                   🇩🇪
#     COUNTRY                Germany
#     RAILWAY_PUBLIC_DOMAIN  <auto-set by Railway>  (makes it a "railway"-capable node)
#
# Option B — VPS (any country):
#   scp -r backend/agent /root/azadi-agent
#   cd /root/azadi-agent
#   npm install
#   export AZADI_PANEL=https://your-panel.up.railway.app
#   export AZADI_SECRET=<the shared secret>
#   export NODE_NAME=Tokyo
#   export FLAG=🇯🇵 COUNTRY=Japan
#   # install xray + wireguard: (xray + wg-quick)
#   npm start   OR   node agent.js

# ── MESH (multi-location) ──────────────────
# When a node connects, the panel pushes a wg0.conf that meshes ALL nodes into
# the 10.77.x.0/24 private network. Traffic can route through any node → any other,
# giving you a single multi-exit network across Railway regions and VPS sites.
# To chain: set user → node A "allow exit via node B" in the panel; the agent on A
# gets a vless outbound to B in its routing rules.

# ── LOCAL DEV ──────────────────────────────
cd backend && npm install && DB_PATH=./data/dev.db node -e "
const db = require('./src/db.js');
const { setSetting } = db;  // already imported db
setSetting('AGENT_SHARED_SECRET', 'dev-shared-secret');
setSetting('JWT_SECRET', 'dev-secret-key-32chars-long!!');
console.log('seeded');
" && node test.mjs
node src/index.js

# Frontend dev (port 5173, proxies /api to panel):
cd ../frontend && npm install && npm run dev
