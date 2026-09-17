const state = {
  session: localStorage.getItem("fakhra-session") || "",
  protocols: [],
  nodes: [],
  clients: [],
  routes: [],
  activeTab: "overview",
  xrayConfig: "",
  xrayScript: ""
};

const titles = {
  overview: ["Control plane", "Overview"],
  nodes: ["Node compatibility", "Nodes"],
  protocols: ["VPN profile catalog", "Protocols"],
  clients: ["Access management", "Clients"],
  routes: ["Multi-location routing", "Routes"],
  xray: ["Core provisioning", "Xray Core"],
  settings: ["Deployment", "Settings"]
};

const iconMap = {
  "Online nodes": "i-server",
  "Locations": "i-route",
  "VPN types": "i-shield",
  "Active clients": "i-users"
};

const qs = selector => document.querySelector(selector);
const qsa = selector => [...document.querySelectorAll(selector)];

function toast(message) {
  const el = qs("#toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.session) headers.Authorization = `Session ${state.session}`;
  const response = await fetch(path, { ...options, headers });
  const text = await response.text();
  const isJson = (response.headers.get("content-type") || "").includes("json");
  const data = text ? (isJson ? JSON.parse(text) : text) : null;
  if (!response.ok) throw new Error(data?.error || response.statusText);
  return data;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));
}

function tag(text) {
  return `<span class="tag">${escapeHtml(text)}</span>`;
}

function icon(id) {
  return `<svg><use href="#${id}"></use></svg>`;
}

function protocolLogo(protocol) {
  const letters = {
    vless: "VL",
    vmess: "VM",
    hysteria2: "HY",
    trojan: "TR",
    shadowsocks: "SS",
    wireguard: "WG",
    tuic: "TC",
    naiveproxy: "NP",
    anytls: "AT"
  };
  const colors = ["green", "", "amber", "rose", "violet"];
  const index = Math.abs([...protocol.id].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % colors.length;
  return `<div class="logo-badge ${colors[index]}">${letters[protocol.id] || protocol.name.slice(0, 2)}</div>`;
}

function setTab(tab) {
  state.activeTab = tab;
  qsa(".tab").forEach(page => page.classList.toggle("active", page.dataset.page === tab));
  qsa(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.tab === tab));
  qs("#sectionKicker").textContent = titles[tab][0];
  qs("#sectionTitle").textContent = titles[tab][1];
  if (tab === "xray") refreshXray().catch(error => toast(error.message));
}

function renderMetrics() {
  const online = state.nodes.filter(node => node.status === "online").length;
  const locations = new Set(state.nodes.map(node => node.location)).size;
  const protocolCount = new Set(state.nodes.flatMap(node => node.protocols || [])).size;
  const clients = state.clients.filter(client => client.status === "active").length;
  qs("#metrics").innerHTML = [
    ["Online nodes", online],
    ["Locations", locations],
    ["VPN types", protocolCount || state.protocols.length],
    ["Active clients", clients]
  ].map(([label, value]) => `
    <article class="metric">
      <div class="metric-icon">${icon(iconMap[label])}</div>
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `).join("");
}

function renderNodes() {
  qs("#nodeList").innerHTML = state.nodes.map(node => {
    const load = Math.max(0, Math.min(100, Number(node.load || 0)));
    return `
      <article class="card">
        <div class="card-top">
          <div>
            <h3>${escapeHtml(node.name)}</h3>
            <p>${escapeHtml(node.location)} · ${escapeHtml(node.region)}</p>
          </div>
          <span class="status">${escapeHtml(node.status)}</span>
        </div>
        <p>${escapeHtml(node.host)}</p>
        <div class="tags">${(node.protocols || []).map(tag).join("")}</div>
        <p>Xray ${escapeHtml(node.xrayVersion || "latest")} · ${node.latency || 0}ms latency · weight ${node.weight || 1}</p>
        <div class="bar"><span style="width:${load}%"></span></div>
      </article>
    `;
  }).join("");
  renderXraySelectors();
}

function renderProtocols() {
  qs("#protocolGrid").innerHTML = state.protocols.map(protocol => `
    <article class="card">
      <div class="card-top">
        ${protocolLogo(protocol)}
        <small>${escapeHtml(protocol.family)}</small>
      </div>
      <h3>${escapeHtml(protocol.name)}</h3>
      <p>Default port ${protocol.defaultPort}</p>
      <div class="tags">${protocol.transport.map(tag).join("")}</div>
    </article>
  `).join("");
}

function renderClients() {
  qs("#clientList").innerHTML = state.clients.map(client => {
    const used = Number(client.usedGb || 0);
    const limit = Number(client.dataLimitGb || 1);
    const percent = Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
    return `
      <article class="card">
        <div class="card-top">
          <div>
            <h3>${escapeHtml(client.name)}</h3>
            <p>${escapeHtml(client.status)} · ${used}GB / ${limit}GB</p>
          </div>
          <button data-sub="${client.id}" title="Copy subscription URL">${icon("i-copy")}<span>Sub</span></button>
        </div>
        <p>${escapeHtml(client.uuid)}</p>
        <div class="tags">${(client.preferredProtocols || []).map(tag).join("")}</div>
        <div class="bar"><span style="width:${percent}%"></span></div>
      </article>
    `;
  }).join("");
  qsa("[data-sub]").forEach(button => {
    button.addEventListener("click", async () => {
      const url = `${location.origin}/sub/${button.dataset.sub}`;
      await navigator.clipboard.writeText(url);
      toast("Subscription URL copied");
    });
  });
  renderXraySelectors();
}

function routeCards(route) {
  return (route.nodes || []).map(node => `
    <div class="item">
      <div class="item-row">
        <strong>${escapeHtml(node.location)}</strong>
        <span class="status">${node.score}</span>
      </div>
      <small>${escapeHtml(node.name)} · ${escapeHtml(node.region)}</small>
      <div class="tags">${(node.compatibleProtocols || []).map(tag).join("")}</div>
    </div>
  `).join("");
}

function renderRoutes() {
  qs("#routeList").innerHTML = state.routes.map(route => `
    <article class="card">
      <div class="card-top">
        <div>
          <h3>${escapeHtml(route.name)}</h3>
          <p>${escapeHtml(route.mode)} · failover ${route.failover ? "on" : "off"}</p>
        </div>
        ${icon("i-route")}
      </div>
      <div class="tags">${(route.protocolPriority || []).map(tag).join("")}</div>
      <div class="list">${routeCards(route)}</div>
    </article>
  `).join("");
  qs("#overviewRoutes").innerHTML = state.routes.slice(0, 1).map(route => routeCards(route)).join("") || "<p>No route data yet.</p>";
}

function renderXraySelectors() {
  const nodes = state.nodes.filter(node => (node.protocols || []).some(protocol => ["vless", "vmess", "trojan", "shadowsocks"].includes(protocol)));
  const nodeSelect = qs("#xrayNode");
  const clientSelect = qs("#xrayClient");
  if (!nodeSelect || !clientSelect) return;
  nodeSelect.innerHTML = nodes.map(node => `<option value="${node.id}">${escapeHtml(node.name)} · ${escapeHtml(node.location)}</option>`).join("");
  clientSelect.innerHTML = state.clients.map(client => `<option value="${client.id}">${escapeHtml(client.name)}</option>`).join("");
}

function renderAll() {
  renderMetrics();
  renderNodes();
  renderProtocols();
  renderClients();
  renderRoutes();
  renderXraySelectors();
}

async function loadAll() {
  const [health, bootstrap, nodes, clients, routes] = await Promise.all([
    api("/api/health"),
    api("/api/bootstrap"),
    api("/api/nodes"),
    api("/api/clients"),
    api("/api/routes")
  ]);
  qs("#healthText").textContent = health.ok ? "Online" : "Needs attention";
  state.protocols = bootstrap.protocols;
  state.nodes = nodes;
  state.clients = clients;
  state.routes = routes;
  renderAll();
}

async function login(event) {
  event.preventDefault();
  const username = qs("#username").value || "admin";
  const password = qs("#password").value || "azadi-admin";
  const result = await api("/api/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
  state.session = result.token;
  localStorage.setItem("fakhra-session", result.token);
  toast("Panel unlocked");
  if (state.activeTab === "xray") await refreshXray();
}

async function addNode() {
  const number = state.nodes.length + 1;
  await api("/api/nodes", {
    method: "POST",
    body: JSON.stringify({
      name: `Xray Edge ${number}`,
      location: ["London", "Paris", "Toronto", "Dubai"][number % 4],
      region: `edge-${number}`,
      host: `node-${number}.example.com`,
      protocols: ["vless", "vmess", "trojan", "shadowsocks", "hysteria2"],
      ports: { vless: 443, vmess: 8443, trojan: 443, shadowsocks: 8388, hysteria2: 443 },
      latency: 25 + number * 6,
      load: 12 + number * 5,
      weight: 2,
      xrayVersion: "latest"
    })
  });
  await loadAll();
  toast("Node added");
}

async function addClient() {
  await api("/api/clients", {
    method: "POST",
    body: JSON.stringify({
      name: `Client ${state.clients.length + 1}`,
      dataLimitGb: 100,
      preferredProtocols: ["vless", "vmess", "trojan", "shadowsocks"]
    })
  });
  await loadAll();
  toast("Client created");
}

async function refreshXray() {
  if (!state.session) {
    qs("#xrayConfig").textContent = "Log in first to generate Xray configs.";
    qs("#xrayScript").textContent = "Log in first to generate install scripts.";
    return;
  }
  const nodeId = qs("#xrayNode")?.value || "";
  const clientId = qs("#xrayClient")?.value || "";
  const query = new URLSearchParams();
  if (nodeId) query.set("nodeId", nodeId);
  if (clientId) query.set("clientId", clientId);
  const result = await api(`/api/xray/config?${query.toString()}`);
  const script = await api(`/api/xray/install-script?${nodeId ? `nodeId=${encodeURIComponent(nodeId)}` : ""}`, { headers: { Accept: "text/plain" } });
  state.xrayConfig = JSON.stringify(result.config, null, 2);
  state.xrayScript = script;
  qs("#xrayConfig").textContent = state.xrayConfig;
  qs("#xrayScript").textContent = state.xrayScript;
}

async function copyText(value, message) {
  await navigator.clipboard.writeText(value);
  toast(message);
}

function setupCursor() {
  const cursor = qs("#cursor");
  window.addEventListener("pointermove", event => {
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
  });
  document.addEventListener("pointerover", event => {
    if (event.target.closest("button, input, select, a")) cursor.classList.add("hot");
  });
  document.addEventListener("pointerout", event => {
    if (event.target.closest("button, input, select, a")) cursor.classList.remove("hot");
  });
}

function setupEvents() {
  qs("#loginForm").addEventListener("submit", event => login(event).catch(error => toast(error.message)));
  qs("#addNode").addEventListener("click", () => addNode().catch(error => toast(error.message)));
  qs("#addClient").addEventListener("click", () => addClient().catch(error => toast(error.message)));
  qs("#refreshXray").addEventListener("click", () => refreshXray().catch(error => toast(error.message)));
  qs("#copyXray").addEventListener("click", () => copyText(state.xrayConfig || qs("#xrayConfig").textContent, "Xray config copied").catch(error => toast(error.message)));
  qs("#copyScript").addEventListener("click", () => copyText(state.xrayScript || qs("#xrayScript").textContent, "Install script copied").catch(error => toast(error.message)));
  qs("#xrayNode").addEventListener("change", () => refreshXray().catch(error => toast(error.message)));
  qs("#xrayClient").addEventListener("change", () => refreshXray().catch(error => toast(error.message)));
  qsa(".nav-item").forEach(button => button.addEventListener("click", () => setTab(button.dataset.tab)));
  qsa("[data-jump]").forEach(button => button.addEventListener("click", () => setTab(button.dataset.jump)));
}

setupCursor();
setupEvents();
loadAll().then(() => setTab("overview")).catch(error => toast(error.message));
