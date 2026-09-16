// Azadi Agent — deploy on every VPN server (Railway region or VPS).
// Connects OUTBOUND to the panel over WebSocket, receives configs, runs proxies.
//
// Env required:
//   AZADI_PANEL=https://your-panel.up.railway.app
//   AZADI_SECRET=<shared secret>
// Optional: NODE_NAME, FLAG, COUNTRY, RAILWAY_PUBLIC_DOMAIN

import { WebSocket } from 'ws';
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const PANEL = process.env.AZADI_PANEL;
const SECRET = process.env.AZADI_SECRET;
if (!PANEL || !SECRET) { console.error('[agent] AZADI_PANEL + AZADI_SECRET required'); process.exit(1); }

const ID = crypto.randomUUID().slice(0, 8);
const WORK = './agent-work';
fs.mkdirSync(WORK, { recursive: true });

const hello = {
  type: 'hello',
  payload: {
    id: ID,
    name: process.env.NODE_NAME || os.hostname(),
    flag: process.env.FLAG || '🏳️',
    country: process.env.COUNTRY || null,
    capability: process.env.RAILWAY_PUBLIC_DOMAIN ? 'railway' : 'vps',
    public_host: process.env.AZADI_PUBLIC_HOST || process.env.RAILWAY_PUBLIC_DOMAIN || os.hostname(),
    info: JSON.stringify({
      platform: `${os.type()} ${os.release()}`,
      cpus: os.cpus().length,
      mem_mb: Math.round(os.totalmem() / 1048576),
    }),
  },
};

let ws;
let backoff = 1000;

function connect() {
  const u = new URL(PANEL);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = '/agent/control';
  u.searchParams.set('secret', SECRET);
  ws = new WebSocket(u.toString());
  ws.on('open', () => {
    backoff = 1000;
    ws.send(JSON.stringify(hello));
    console.log(`[agent] ${hello.payload.name} (${ID}) → ${u.origin}`);
  });
  ws.on('message', handle);
  ws.on('close', () => { console.log(`[agent] disconnected, retry in ${backoff}ms`); setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 30000); });
  ws.on('error', (e) => console.log('[agent] ws error:', e.message));
}

function handle(raw) {
  let m; try { m = JSON.parse(raw.toString()); } catch { return; }
  if (m.type === 'apply') {
    const p = m.payload;
    if (p.xray) {
      const f = path.join(WORK, 'xray.json');
      fs.writeFileSync(f, JSON.stringify(p.xray, null, 2));
      console.log('[agent] xray config written →', f);
      // To actually run: spawn('xray', ['run', '-c', f])
    }
    if (p.hysteria) {
      const f = path.join(WORK, 'hysteria.yaml');
      fs.writeFileSync(f, yamlish(p.hysteria));
      console.log('[agent] hysteria config written →', f);
    }
    if (p.wireguard) {
      const f = path.join(WORK, 'wg0.conf');
      fs.writeFileSync(f, p.wireguard);
      console.log('[agent] wireguard mesh config written →', f);
    }
  }
}

const report = setInterval(() => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'stats',
      payload: {
        id: ID, ts: Math.floor(Date.now() / 1000),
        sys: { cpu_pct: Math.round(os.loadavg()[0]), mem_pct: Math.round((1 - os.freemem()/os.totalmem())*100) },
        version: hello.payload.info,
      },
    }));
  }
}, 30000);

function yamlish(obj) {
  const lines = [];
  const emit = (o, ind = 0) => {
    for (const [k, v] of Object.entries(o)) {
      if (v === undefined || v === null) continue;
      const pad = '  '.repeat(ind);
      if (typeof v === 'object' && !Array.isArray(v)) { lines.push(`${pad}${k}:`); emit(v, ind + 1); }
      else if (Array.isArray(v)) lines.push(`${pad}${k}: [${v.join(', ')}]`);
      else lines.push(`${pad}${k}: ${JSON.stringify(v)}`);
    }
  };
  emit(obj);
  return lines.join('\n');
}

connect();
