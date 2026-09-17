const state = {
  session: localStorage.getItem("fakhra-session") || "",
  protocols: [],
  nodes: [],
  clients: [],
  routes: []
};

const qs = selector => document.querySelector(selector);
const qsa = selector => [...document.querySelectorAll(selector)];

function toast(message) {
  const el = qs("#toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.session) headers.Authorization = `Session ${state.session}`;
  const response = await fetch(path, { ...options, headers });
  const text = await response.text();
  const data = text ? (response.headers.get("content-type") || "").includes("json") ? JSON.parse(text) : text : null;
  if (!response.ok) throw new Error(data?.error || response.statusText);
  return data;
}

function renderMetrics() {
  const online = state.nodes.filter(node => node.status === "online").length;
  const locations = new Set(state.nodes.map(node => node.location)).size;
  const protocolCount = new Set(state.nodes.flatMap(node => node.protocols)).size;
  const clients = state.clients.filter(client => client.status === "active").length;
  qs("#metrics").innerHTML = [
    ["Online nodes", online],
    ["Locations", locations],
    ["VPN types", protocolCount || state.protocols.length],
    ["Active clients", clients]
  ].map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function tag(text) {
  return `<span class="tag">${escapeHtml(text)}</span>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));
}

function renderNodes() {
  qs("#nodeList").innerHTML = state.nodes.map(node => `
    <div class="item">
      <div class="item-row">
        <strong>${escapeHtml(node.name)}</strong>
        <span class="status">${escapeHtml(node.status)}</span>
      </div>
      <div class="item-row">
        <small>${escapeHtml(node.location)} · ${escapeHtml(node.region)}</small>
        <small>${escapeHtml(node.host)}</small>
      </div>
      <div class="tags">${node.protocols.map(tag).join("")}</div>
      <small>Latency ${node.latency || 0}ms · Load ${node.load || 0}% · Weight ${node.weight || 1}</small>
    </div>
  `).join("");
}

function renderProtocols() {
  qs("#protocolGrid").innerHTML = state.protocols.map(protocol => `
    <div class="item">
      <div class="item-row">
        <strong>${escapeHtml(protocol.name)}</strong>
        <small>${escapeHtml(protocol.family)}</small>
      </div>
      <div class="tags">${protocol.transport.map(tag).join("")}</div>
      <small>Default port ${protocol.defaultPort}</small>
    </div>
  `).join("");
}

function renderClients() {
  qs("#clientList").innerHTML = state.clients.map(client => `
    <div class="item">
      <div class="item-row">
        <strong>${escapeHtml(client.name)}</strong>
        <span class="status">${escapeHtml(client.status)}</span>
      </div>
      <small>${escapeHtml(client.uuid)}</small>
      <div class="tags">${client.preferredProtocols.map(tag).join("")}</div>
      <div class="item-row">
        <small>${client.usedGb || 0}GB / ${client.dataLimitGb || 0}GB</small>
        <button data-sub="${client.id}">Copy sub</button>
      </div>
    </div>
  `).join("");
  qsa("[data-sub]").forEach(button => {
    button.addEventListener("click", async () => {
      const url = `${location.origin}/sub/${button.dataset.sub}`;
      await navigator.clipboard.writeText(url);
      toast("Subscription URL copied");
    });
  });
}

function renderRoutes() {
  qs("#routeList").innerHTML = state.routes.map(route => `
    <div class="item">
      <div class="item-row">
        <strong>${escapeHtml(route.name)}</strong>
        <small>${escapeHtml(route.mode)}</small>
      </div>
      <div class="tags">${route.protocolPriority.map(tag).join("")}</div>
      ${route.nodes.map(node => `
        <div class="item-row">
          <small>${escapeHtml(node.location)} · ${escapeHtml(node.compatibleProtocols.join(", "))}</small>
          <strong>${node.score}</strong>
        </div>
      `).join("")}
    </div>
  `).join("");
}

function renderAll() {
  renderMetrics();
  renderNodes();
  renderProtocols();
  renderClients();
  renderRoutes();
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
}

async function addNode() {
  const number = state.nodes.length + 1;
  const node = await api("/api/nodes", {
    method: "POST",
    body: JSON.stringify({
      name: `Edge Node ${number}`,
      location: ["London", "Paris", "Toronto", "Dubai"][number % 4],
      region: `region-${number}`,
      host: `node-${number}.example.com`,
      protocols: ["vless", "hysteria2", "vmess"],
      ports: { vless: 443, hysteria2: 443, vmess: 8443 },
      latency: 35 + number * 7,
      load: 12 + number * 4,
      weight: 2
    })
  });
  state.nodes.push(node);
  await loadAll();
  toast("Node added");
}

async function addClient() {
  const client = await api("/api/clients", {
    method: "POST",
    body: JSON.stringify({
      name: `Client ${state.clients.length + 1}`,
      dataLimitGb: 100,
      preferredProtocols: ["vless", "hysteria2", "vmess"]
    })
  });
  state.clients.push(client);
  await loadAll();
  toast("Client created");
}

function setupCursor() {
  const cursor = qs("#cursor");
  window.addEventListener("pointermove", event => {
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
  });
  qsa("button, a, input").forEach(el => {
    el.addEventListener("pointerenter", () => cursor.classList.add("hot"));
    el.addEventListener("pointerleave", () => cursor.classList.remove("hot"));
  });
}

function setupNav() {
  qsa("nav a").forEach(link => {
    link.addEventListener("click", () => {
      qsa("nav a").forEach(item => item.classList.remove("active"));
      link.classList.add("active");
    });
  });
}

qs("#loginForm").addEventListener("submit", event => login(event).catch(error => toast(error.message)));
qs("#addNode").addEventListener("click", () => addNode().catch(error => toast(error.message)));
qs("#addClient").addEventListener("click", () => addClient().catch(error => toast(error.message)));
setupCursor();
setupNav();
loadAll().catch(error => toast(error.message));
