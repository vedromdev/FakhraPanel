const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const PANEL_USER = process.env.PANEL_USER || "admin";
const PANEL_PASSWORD = process.env.PANEL_PASSWORD || "azadi-admin";
const PANEL_TOKEN = process.env.PANEL_TOKEN || "change-this-token";
const DATA_FILE = path.join(__dirname, "data", "state.json");
const PUBLIC_DIR = path.join(__dirname, "public");

const protocolCatalog = [
  { id: "vless", name: "VLESS", family: "Xray", transport: ["tcp", "ws", "grpc", "reality"], defaultPort: 443 },
  { id: "vmess", name: "VMess / V2Ray", family: "V2Ray", transport: ["tcp", "ws", "grpc"], defaultPort: 443 },
  { id: "hysteria2", name: "Hysteria 2", family: "Hysteria", transport: ["udp", "quic"], defaultPort: 443 },
  { id: "trojan", name: "Trojan", family: "Xray", transport: ["tcp", "ws", "grpc"], defaultPort: 443 },
  { id: "shadowsocks", name: "Shadowsocks", family: "Proxy", transport: ["tcp", "udp"], defaultPort: 8388 },
  { id: "wireguard", name: "WireGuard", family: "Tunnel", transport: ["udp"], defaultPort: 51820 },
  { id: "tuic", name: "TUIC", family: "QUIC", transport: ["udp", "quic"], defaultPort: 443 },
  { id: "naiveproxy", name: "NaiveProxy", family: "HTTP/2", transport: ["https"], defaultPort: 443 },
  { id: "anytls", name: "AnyTLS", family: "TLS", transport: ["tcp"], defaultPort: 443 }
];

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function uuid() {
  return crypto.randomUUID();
}

function defaultState() {
  const clientId = id("client");
  return {
    meta: {
      app: "Fakhra Panel",
      package: "azadi-panel",
      createdAt: now(),
      updatedAt: now()
    },
    settings: {
      panelName: "Fakhra Panel",
      publicBaseUrl: "",
      nodeSecret: PANEL_TOKEN
    },
    nodes: [
      {
        id: id("node"),
        name: "Railway Control Plane",
        location: "Railway",
        region: "control",
        host: "your-railway-domain.up.railway.app",
        status: "online",
        role: "panel",
        protocols: ["vless", "vmess", "hysteria2", "trojan"],
        ports: { vless: 443, vmess: 443, hysteria2: 443, trojan: 443 },
        weight: 1,
        latency: 36,
        load: 18,
        lastSeen: now(),
        createdAt: now()
      },
      {
        id: id("node"),
        name: "Germany Edge",
        location: "Frankfurt",
        region: "eu-central",
        host: "de.example.com",
        status: "online",
        role: "edge",
        protocols: ["vless", "hysteria2", "tuic"],
        ports: { vless: 443, hysteria2: 443, tuic: 443 },
        weight: 3,
        latency: 54,
        load: 31,
        lastSeen: now(),
        createdAt: now()
      },
      {
        id: id("node"),
        name: "Singapore Edge",
        location: "Singapore",
        region: "ap-southeast",
        host: "sg.example.com",
        status: "online",
        role: "edge",
        protocols: ["vmess", "vless", "shadowsocks"],
        ports: { vmess: 8443, vless: 443, shadowsocks: 8388 },
        weight: 2,
        latency: 82,
        load: 44,
        lastSeen: now(),
        createdAt: now()
      }
    ],
    clients: [
      {
        id: clientId,
        name: "Personal Device",
        uuid: uuid(),
        status: "active",
        dataLimitGb: 250,
        usedGb: 18,
        preferredProtocols: ["vless", "hysteria2", "vmess"],
        allowedRegions: ["eu-central", "ap-southeast"],
        createdAt: now()
      }
    ],
    routes: [
      {
        id: id("route"),
        name: "Global Smart Route",
        mode: "balanced",
        entryRegion: "auto",
        failover: true,
        protocolPriority: ["vless", "hysteria2", "vmess", "trojan", "shadowsocks"],
        nodeIds: [],
        createdAt: now()
      }
    ],
    sessions: []
  };
}

function ensureDataFile() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    writeState(defaultState());
  }
}

function readState() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeState(state) {
  state.meta.updatedAt = now();
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(payload);
}

function sendJson(res, status, body) {
  send(res, status, body, { "Content-Type": "application/json; charset=utf-8" });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function isAuthorized(req) {
  const header = req.headers.authorization || "";
  return header === `Bearer ${PANEL_TOKEN}`;
}

function createSession(username) {
  const state = readState();
  const token = crypto.randomBytes(24).toString("hex");
  state.sessions = state.sessions.filter(session => Date.now() - session.createdAt < 1000 * 60 * 60 * 12);
  state.sessions.push({ token, username, createdAt: Date.now() });
  writeState(state);
  return token;
}

function hasSession(req) {
  const header = req.headers.authorization || "";
  const token = header.replace("Session ", "");
  const state = readState();
  return state.sessions.some(session => session.token === token && Date.now() - session.createdAt < 1000 * 60 * 60 * 12);
}

function requireWriteAuth(req, res) {
  if (isAuthorized(req) || hasSession(req)) return true;
  sendJson(res, 401, { error: "Unauthorized. Use panel login or Authorization: Bearer PANEL_TOKEN." });
  return false;
}

function cleanNode(input) {
  const protocols = Array.isArray(input.protocols) ? input.protocols.filter(Boolean) : [];
  return {
    id: input.id || id("node"),
    name: String(input.name || "Unnamed Node").slice(0, 80),
    location: String(input.location || "Unknown").slice(0, 80),
    region: String(input.region || "global").slice(0, 80),
    host: String(input.host || "").slice(0, 160),
    status: ["online", "offline", "maintenance"].includes(input.status) ? input.status : "online",
    role: input.role || "edge",
    protocols,
    ports: input.ports && typeof input.ports === "object" ? input.ports : {},
    weight: Number(input.weight || 1),
    latency: Number(input.latency || 0),
    load: Number(input.load || 0),
    lastSeen: now(),
    createdAt: input.createdAt || now()
  };
}

function cleanClient(input) {
  return {
    id: input.id || id("client"),
    name: String(input.name || "New Client").slice(0, 80),
    uuid: input.uuid || uuid(),
    status: ["active", "paused"].includes(input.status) ? input.status : "active",
    dataLimitGb: Number(input.dataLimitGb || 100),
    usedGb: Number(input.usedGb || 0),
    preferredProtocols: Array.isArray(input.preferredProtocols) ? input.preferredProtocols : ["vless"],
    allowedRegions: Array.isArray(input.allowedRegions) ? input.allowedRegions : [],
    createdAt: input.createdAt || now()
  };
}

function subscriptionLines(client, nodes) {
  const allowed = nodes.filter(node => node.status === "online");
  return allowed.flatMap(node => {
    const protocols = client.preferredProtocols.filter(protocol => node.protocols.includes(protocol));
    return protocols.map(protocol => makeLink(protocol, client, node));
  }).filter(Boolean);
}

function makeLink(protocol, client, node) {
  const port = node.ports[protocol] || protocolCatalog.find(item => item.id === protocol)?.defaultPort || 443;
  const label = encodeURIComponent(`Fakhra-${node.location}-${protocol}`);
  const host = node.host || "example.com";
  if (protocol === "vless") return `vless://${client.uuid}@${host}:${port}?encryption=none&security=tls&type=ws#${label}`;
  if (protocol === "vmess") {
    const payload = Buffer.from(JSON.stringify({ v: "2", ps: `Fakhra-${node.location}`, add: host, port, id: client.uuid, aid: "0", net: "ws", type: "none", host, path: "/", tls: "tls" })).toString("base64url");
    return `vmess://${payload}`;
  }
  if (protocol === "hysteria2") return `hysteria2://${client.uuid}@${host}:${port}?sni=${host}&insecure=0#${label}`;
  if (protocol === "trojan") return `trojan://${client.uuid}@${host}:${port}?security=tls&type=tcp#${label}`;
  if (protocol === "shadowsocks") return `ss://${Buffer.from(`aes-256-gcm:${client.uuid}@${host}:${port}`).toString("base64url")}#${label}`;
  if (protocol === "tuic") return `tuic://${client.uuid}:${client.uuid}@${host}:${port}?congestion_control=bbr#${label}`;
  if (protocol === "naiveproxy") return `https://${client.uuid}:${client.uuid}@${host}:${port}#${label}`;
  if (protocol === "anytls") return `anytls://${client.uuid}@${host}:${port}?sni=${host}#${label}`;
  if (protocol === "wireguard") return `wireguard://${client.uuid}@${host}:${port}#${label}`;
  return null;
}

function routePreview(state) {
  return state.routes.map(route => {
    const nodes = state.nodes
      .filter(node => node.status === "online")
      .filter(node => !route.nodeIds.length || route.nodeIds.includes(node.id))
      .sort((a, b) => (a.load + a.latency / 10) - (b.load + b.latency / 10));
    return {
      ...route,
      nodes: nodes.map(node => ({
        id: node.id,
        name: node.name,
        location: node.location,
        region: node.region,
        compatibleProtocols: route.protocolPriority.filter(protocol => node.protocols.includes(protocol)),
        score: Math.max(1, Math.round(100 - node.load - node.latency / 5 + node.weight * 4))
      }))
    };
  });
}

function contentType(filePath) {
  const ext = path.extname(filePath);
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml"
  }[ext] || "application/octet-stream";
}

function serveStatic(req, res, pathname) {
  const filePath = pathname === "/" ? path.join(PUBLIC_DIR, "index.html") : path.join(PUBLIC_DIR, pathname);
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(PUBLIC_DIR)) return send(res, 403, "Forbidden");
  fs.readFile(normalized, (error, data) => {
    if (error) return send(res, 404, "Not found");
    res.writeHead(200, { "Content-Type": contentType(normalized), "Cache-Control": "public, max-age=3600" });
    res.end(data);
  });
}

async function handleApi(req, res, url) {
  const state = readState();
  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, app: "Fakhra Panel", package: "azadi-panel", railway: Boolean(process.env.RAILWAY_ENVIRONMENT), time: now() });
  }
  if (req.method === "GET" && url.pathname === "/api/bootstrap") {
    return sendJson(res, 200, { meta: state.meta, settings: { panelName: state.settings.panelName }, protocols: protocolCatalog });
  }
  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await parseBody(req);
    if (body.username === PANEL_USER && body.password === PANEL_PASSWORD) {
      return sendJson(res, 200, { token: createSession(body.username), user: body.username });
    }
    return sendJson(res, 401, { error: "Invalid login" });
  }
  if (req.method === "GET" && url.pathname === "/api/protocols") {
    return sendJson(res, 200, protocolCatalog);
  }
  if (req.method === "GET" && url.pathname === "/api/nodes") {
    return sendJson(res, 200, state.nodes);
  }
  if (req.method === "POST" && (url.pathname === "/api/nodes" || url.pathname === "/api/nodes/register")) {
    if (!requireWriteAuth(req, res)) return;
    const node = cleanNode(await parseBody(req));
    const index = state.nodes.findIndex(item => item.id === node.id || item.host === node.host);
    if (index >= 0) state.nodes[index] = { ...state.nodes[index], ...node, lastSeen: now() };
    else state.nodes.push(node);
    writeState(state);
    return sendJson(res, 201, node);
  }
  if (req.method === "GET" && url.pathname === "/api/clients") {
    return sendJson(res, 200, state.clients);
  }
  if (req.method === "POST" && url.pathname === "/api/clients") {
    if (!requireWriteAuth(req, res)) return;
    const client = cleanClient(await parseBody(req));
    state.clients.push(client);
    writeState(state);
    return sendJson(res, 201, client);
  }
  if (req.method === "GET" && url.pathname === "/api/routes") {
    return sendJson(res, 200, routePreview(state));
  }
  if (req.method === "POST" && url.pathname === "/api/routes") {
    if (!requireWriteAuth(req, res)) return;
    const body = await parseBody(req);
    const route = {
      id: body.id || id("route"),
      name: String(body.name || "New Route").slice(0, 80),
      mode: body.mode || "balanced",
      entryRegion: body.entryRegion || "auto",
      failover: body.failover !== false,
      protocolPriority: Array.isArray(body.protocolPriority) ? body.protocolPriority : ["vless", "hysteria2", "vmess"],
      nodeIds: Array.isArray(body.nodeIds) ? body.nodeIds : [],
      createdAt: body.createdAt || now()
    };
    state.routes.push(route);
    writeState(state);
    return sendJson(res, 201, route);
  }
  if (req.method === "GET" && url.pathname.startsWith("/sub/")) {
    const clientId = url.pathname.split("/").pop();
    const client = state.clients.find(item => item.id === clientId || item.uuid === clientId);
    if (!client) return send(res, 404, "Client not found");
    const lines = subscriptionLines(client, state.nodes).join("\n");
    return send(res, 200, lines, { "Content-Type": "text/plain; charset=utf-8" });
  }
  sendJson(res, 404, { error: "API route not found" });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/sub/")) {
      await handleApi(req, res, url);
      return;
    }
    serveStatic(req, res, decodeURIComponent(url.pathname));
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  ensureDataFile();
  console.log(`Fakhra Panel running on port ${PORT}`);
});
