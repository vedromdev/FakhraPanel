// Azadi Panel — unified project scaffold.
// Backend = control-plane API (deploy to Railway service #1).
// Node = agent.js running on each railway-node or VPS (Railway service B/C/D or any country VPS).
// The panel is the brain; agents connect OUTBOUND over one WS control channel and
// receive per-node xray/hysteria2/wireguard-mesh configs automatically.

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import staticPlugin from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import db, { getSetting, setSetting } from './db.js';
import { ensureAdmin, authHook } from './services/auth.js';
import { generateConfigForNode, pushConfig, connections } from './services/node-manager.js';
import { buildSubscription } from './protocols.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'azadi-admin-change-me';
const SESSION_TTL = 60 * 60 * 24 * 7;

const app = Fastify({ logger: process.env.NODE_ENV === 'development' });

app.register(cors, { origin: true, credentials: true });
app.register(websocket);

// bootstrap first admin
ensureAdmin();

// ---------- API: Auth ----------
app.post('/api/login', async (req, reply) => {
  const { username, password } = req.body || {};
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password || '', admin.password_hash)) return reply.code(401).send({ error: 'invalid' });
  const token = randomUUID();
  db.prepare('INSERT INTO sessions (token, admin_id, expires_at) VALUES (?, ?, ?)').run(token, admin.id, Math.floor(Date.now() / 1000) + SESSION_TTL);
  return { token, username };
});

// ---------- API: Nodes ----------
app.get('/api/nodes', { preValidation: authHook }, () => {
  const rows = db.prepare('SELECT * FROM nodes ORDER BY created_at DESC').all();
  return rows.map(r => {
    let info = {}; try { info = r.info ? JSON.parse(r.info) : {}; } catch {}
    return { id: r.id, name: r.name, flag: r.flag, country: r.country,
      agent_id: r.agent_id, public_host: r.public_host, capability: r.capability || 'vps',
      status: r.status, last_seen: r.last_seen, version: r.version, wg_ip: r.wg_ip, info };
  });
});

app.get('/api/nodes/:id', { preValidation: authHook }, (req, reply) => {
  const r = db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id);
  if (!r) return reply.code(404).send({ error: 'not found' });
  let info = {}; try { info = r.info ? JSON.parse(r.info) : {}; } catch {}
  return { id: r.id, name: r.name, flag: r.flag, country: r.country, agent_id: r.agent_id,
    public_host: r.public_host, capability: r.capability || 'vps', status: r.status,
    last_seen: r.last_seen, version: r.version, wg_ip: r.wg_ip, info };
});

app.post('/api/nodes', { preValidation: authHook }, (req, reply) => {
  const b = req.body || {};
  if (!b.name) return reply.code(400).send({ error: 'name required' });
  const r = db.prepare(`INSERT INTO nodes (name, flag, country, agent_id, public_host, capability, port_base, sni, wg_ip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(b.name, b.flag || '🏳️', b.country || null, b.agent_id || null,
    b.public_host || null, b.capability || 'vps', b.port_base || 40000, b.sni || null, b.wg_ip || null);
  return reply.code(201).send({ id: Number(r.lastInsertRowid) });
});

app.put('/api/nodes/:id', { preValidation: authHook }, (req, reply) => {
  const b = req.body || {};
  db.prepare('UPDATE nodes SET name = ?, flag = ?, country = ?, public_host = ?, capability = ?, sni = ?, wg_ip = ?, status = ? WHERE id = ?')
    .run(b.name, b.flag, b.country, b.public_host, b.capability, b.sni, b.wg_ip, b.status, req.params.id);
  return { ok: true };
});

app.delete('/api/nodes/:id', { preValidation: authHook }, (req, reply) => {
  db.prepare('DELETE FROM nodes WHERE id = ?').run(req.params.id);
  return reply.code(204).send();
});

app.post('/api/nodes/:id/deploy', { preValidation: authHook }, async (req, reply) => {
  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id);
  if (!node) return reply.code(404).send({ error: 'not found' });
  if (!node.agent_id) return reply.code(503).send({ error: 'no agent registered for this node yet' });
  try {
    const cfg = generateConfigForNode(node);
    pushConfig(node.agent_id, cfg);
    reply.send({ status: 'deployed', config: cfg });
  } catch (e) {
    reply.code(503).send({ error: 'agent offline', message: String(e) });
  }
});

// ---------- API: Users ----------
app.get('/api/users', { preValidation: authHook }, () => {
  const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  return rows.map(u => ({
    id: u.id, name: u.name, uuid: u.uuid, sub_token: u.sub_token,
    data_limit_gb: u.data_limit_gb, used_bytes: u.used_bytes,
    usage_gb: Number((u.used_bytes / 1073741824).toFixed(2)),
    expires_at: u.expires_at, enabled: !!u.enabled,
    nodes: db.prepare('SELECT node_id FROM assignments WHERE user_id = ?').all(u.id).map(r => r.node_id),
  }));
});

app.post('/api/users', { preValidation: authHook }, (req, reply) => {
  const b = req.body || {};
  if (!b.name) return reply.code(400).send({ error: 'name required' });
  const uuid = b.uuid || randomUUID();
  const sub = b.sub_token || randomUUID().replace(/-/g, '');
  const r = db.prepare('INSERT INTO users (name, uuid, sub_token, data_limit_gb, expires_at) VALUES (?, ?, ?, ?, ?)').run(
    b.name, uuid, sub, b.data_limit_gb || 0, b.expires_at || null);
  for (const nid of b.nodes || []) {
    db.prepare('INSERT OR IGNORE INTO assignments (user_id, node_id) VALUES (?, ?)').run(Number(r.lastInsertRowid), nid);
  }
  return reply.code(201).send(db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid));
});

app.put('/api/users/:id', { preValidation: authHook }, (req, reply) => {
  const b = req.body || {};
  const sets = [], vals = [];
  for (const f of ['name', 'uuid', 'data_limit_gb', 'expires_at', 'enabled']) {
    if (b[f] !== undefined) { sets.push(`${f} = ?`); vals.push(b[f]); }
  }
  if (sets.length) { vals.push(req.params.id); db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals); }
  if (b.nodes) {
    db.prepare('DELETE FROM assignments WHERE user_id = ?').run(req.params.id);
    for (const nid of b.nodes) db.prepare('INSERT OR IGNORE INTO assignments (user_id, node_id) VALUES (?, ?)').run(req.params.id, nid);
  }
  return { ok: true };
});

// ---------- API: Settings ----------
app.get('/api/settings', { preValidation: authHook }, () => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
});
app.put('/api/settings', { preValidation: authHook }, (req) => {
  for (const [k, v] of Object.entries(req.body || {})) setSetting(k, v);
  return { ok: true };
});

// ---------- API: Protocols overview ----------
app.get('/api/protocols', { preValidation: authHook }, () => ({
  protocols: ['vless', 'vmess', 'hysteria2', 'shadowsocks', 'trojan', 'tuic', 'wireguard'],
  railway_compatible: ['vless', 'vmess', 'trojan'],
  vps_only: ['vless-reality', 'hysteria2', 'shadowsocks', 'tuic', 'wireguard-mesh'],
}));

// ---------- API: Traffic stats ----------
app.get('/api/stats', { preValidation: authHook }, () => ({
  nodes_online: db.prepare("SELECT COUNT(*) c FROM nodes WHERE status = 'online'").get().c,
  nodes_total: db.prepare('SELECT COUNT(*) c FROM nodes').get().c,
  users_total: db.prepare('SELECT COUNT(*) c FROM users').get().c,
}));

// ---------- Subscription ----------
app.get('/sub/:token', async (req, reply) => {
  const user = db.prepare('SELECT * FROM users WHERE sub_token = ?').get(req.params.token);
  if (!user || !user.enabled) return reply.code(404).send('not found');
  if (user.expires_at && user.expires_at < Math.floor(Date.now() / 1000)) return reply.code(403).send('expired');
  const nodeRows = db.prepare(`SELECT n.* FROM nodes n JOIN assignments a ON a.node_id = n.id WHERE a.user_id = ? AND n.status != 'banned'`).all(user.id);
  const nodes = nodeRows.map(r => ({ ...r, capability: r.capability || 'vps' }));
  const links = buildSubscription(user, nodes);
  reply.header('content-type', 'text/plain');
  return Buffer.from(links.join('\n')).toString('base64');
});

// ---------- Agent control channel ----------
app.register(async (instance) => {
  instance.get('/agent/control', { websocket: true }, (conn, req) => {
    const url = new URL(req.url, 'http://x');
    const agentId = url.searchParams.get('id');
    const secret = url.searchParams.get('secret');
    const SHARED = getSetting('AGENT_SHARED_SECRET', '');
    if (!SHARED || secret !== SHARED) { conn.close(4001, 'bad secret'); return; }
    const existed = connections.has(agentId);
    connections.set(agentId, conn);
    db.prepare('UPDATE nodes SET status = ?, last_seen = ? WHERE agent_id = ?')
      .run('online', Math.floor(Date.now() / 1000), agentId);
    if (!existed) console.log(`[agent] connected: ${agentId}`);
    conn.on('message', (raw) => {
      let m; try { m = JSON.parse(raw.toString()); } catch { return; }
      if (m.type === 'stats' && m.payload) {
        const p = m.payload;
        db.prepare('UPDATE nodes SET last_seen = ?, version = ?, info = ? WHERE agent_id = ?')
          .run(p.ts, p.version, JSON.stringify(p.sys || {}), agentId);
      }
    });
    conn.on('close', () => {
      connections.delete(agentId);
      db.prepare('UPDATE nodes SET status = ? WHERE agent_id = ?').run('offline', agentId);
    });
  });
});

// ---------- Dashboard live feed ----------
const dashClients = new Set();
app.register(async (instance) => {
  instance.get('/ws/dashboard', { preValidation: authHook, websocket: true }, (conn) => {
    dashClients.add(conn);
    conn.on('close', () => dashClients.delete(conn));
  });
});
setInterval(() => {
  if (!dashClients.size) return;
  const stats = {
    nodes_online: db.prepare("SELECT COUNT(*) c FROM nodes WHERE status = 'online'").get().c,
    nodes_total: db.prepare('SELECT COUNT(*) c FROM nodes').get().c,
    users_total: db.prepare('SELECT COUNT(*) c FROM users').get().c,
  };
  const msg = JSON.stringify({ type: 'stats', payload: stats });
  for (const c of dashClients) if (c.readyState === 1) c.send(msg);
}, 3000);

// ---------- Serve frontend (built) ----------
const distDir = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(distDir)) {
  await app.register(staticPlugin, { root: distDir });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/agent') || req.url.startsWith('/sub') || req.url.startsWith('/ws'))
      return reply.code(404).send({ error: 'not found' });
    return reply.sendFile('index.html');
  });
}

const PORT = process.env.PORT || 3000;
app.listen({ port: Number(PORT), host: '0.0.0.0' }, (err) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(`azadi-panel ✓  :${PORT}`);
});
