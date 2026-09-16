// Build client-facing connection configs for every supported protocol.
// `node` provides the public endpoint; `user` provides the identity (uuid / secrets).
// Result is a list of "clients" the agent turns into an xray / hysteria2 / sing-box config.

import { createHash, randomBytes } from 'node:crypto';

export const PROTOCOLS = ['vless', 'vmess', 'hysteria2', 'shadowsocks', 'trojan', 'tuic', 'wireguard'];

function b64(s) { return Buffer.from(s, 'utf8').toString('base64url'); }

// Generate all per-user secrets deterministically from the user uuid + protocol.
export function secretsFor(user, protocol) {
  const h = (suffix) => createHash('sha256').update(user.uuid + '|' + suffix).digest('hex');
  switch (protocol) {
    case 'vless':
    case 'vmess': return { id: user.uuid };
    case 'hysteria2': return { password: h('hy2') };
    case 'shadowsocks': return { password: h('ss'), method: '2022-blake3-aes-256-gcm' };
    case 'trojan': return { password: h('trojan') };
    case 'tuic': return { password: h('tuic'), uuid: user.uuid };
    case 'wireguard': return { privateKey: h('wg').slice(0, 44) };
    default: return {};
  }
}

// Railway's edge forwards HTTP/WS only (TLS terminated at the edge). Raw TCP/UDP/QUIC
// ports are NOT reachable on a Railway service. VPS nodes can expose everything.
export function protocolsFor(node) {
  if (node.capability === 'vps') return PROTOCOLS;
  return ['vless', 'vmess', 'trojan']; // railway: ws-only transports
}

// Build one client config object for a (user, node, protocol) tuple.
export function buildClient(user, node, protocol) {
  const host = node.public_host;
  const onRailway = node.capability !== 'vps';
  const port = onRailway ? 443 : nodePort(node, protocol);
  const s = secretsFor(user, protocol);
  const flag = node.flag || '🌐';
  const remark = `${flag} ${node.country || node.name} · ${protocol.toUpperCase()} · ${user.name}`;
  const common = { protocol, host, port, remark };

  switch (protocol) {
    case 'vless':
      return { ...common, id: s.id, flow: onRailway ? undefined : 'xtls-rprx-vision', transport: 'ws', path: '/vless',
               sni: host, tls: onRailway ? 'tls' : 'reality', pbk: onRailway ? undefined : node.pbk, sid: onRailway ? undefined : node.sid };
    case 'vmess':
      return { ...common, id: s.id, transport: 'ws', path: '/vmess', sni: host, tls: 'tls' };
    case 'hysteria2':
      return { ...common, password: s.password, sni: host, obfs: 'salamander', obfs_pw: node.sid };
    case 'shadowsocks':
      return { ...common, password: s.password, method: s.method };
    case 'trojan':
      return { ...common, password: s.password, sni: host, transport: 'ws', path: '/trojan' };
    case 'tuic':
      return { ...common, password: s.password, uuid: s.uuid, sni: host, congestion: 'bbr' };
    case 'wireguard':
      return { ...common, privateKey: s.privateKey, peerKey: node.wg_pub, address: node.wg_ip, allowed: '0.0.0.0/0, ::/0' };
    default: return common;
  }
}

// Each node exposes a fixed port per protocol (configurable). Default map:
function nodePort(node, protocol) {
  const base = Number(node.port_base || 40000);
  const idx = PROTOCOLS.indexOf(protocol);
  return base + idx * 100;
}

// ---- Shareable links (work in v2rayNG, Streisand, Happ, Nekobox, etc.) ----
function vlessLink(c) {
  const q = new URLSearchParams();
  if (c.flow) q.set('flow', c.flow);
  q.set('type', c.transport); q.set('security', c.tls);
  if (c.transport === 'ws') { q.set('path', c.path); q.set('host', c.sni || c.host); }
  if (c.tls === 'reality') { q.set('pbk', c.pbk || ''); q.set('sni', c.sni); q.set('sid', c.sid || ''); q.set('fp', 'chrome'); }
  if (c.tls === 'tls' && c.sni) q.set('sni', c.sni);
  return `vless://${c.id}@${c.host}:${c.port}?${q.toString()}#${encodeURIComponent(c.remark)}`;
}

function vmessLink(c) {
  const obj = { v: '2', ps: c.remark, add: c.host, port: c.port, id: c.id, aid: '0', scy: 'auto',
    net: c.transport, type: 'none', host: c.sni, path: c.path, tls: c.tls };
  return `vmess://${Buffer.from(JSON.stringify(obj)).toString('base64')}`;
}

function trojanLink(c) {
  const q = new URLSearchParams({ type: c.transport, path: c.path, sni: c.sni });
  return `trojan://${c.password}@${c.host}:${c.port}?${q}#${encodeURIComponent(c.remark)}`;
}

function ssLink(c) {
  return `ss://${Buffer.from(`${c.method}:${c.password}`).toString('base64url')}@${c.host}:${c.port}#${encodeURIComponent(c.remark)}`;
}

function hy2Link(c) {
  const q = new URLSearchParams({ sni: c.sni });
  if (c.obfs) q.set('obfs', c.obfs), q.set('obfs-password', c.obfs_pw);
  return `hysteria2://${encodeURIComponent(c.password)}@${c.host}:${c.port}?${q}#${encodeURIComponent(c.remark)}`;
}

function tuicLink(c) {
  const q = new URLSearchParams({ sni: c.sni, congestion_control: c.congestion, algorithm: 'aes-128-gcm' });
  return `tuic://${c.uuid}:${c.password}@${c.host}:${c.port}?${q}#${encodeURIComponent(c.remark)}`;
}

function wgLink(c) {
  return `[Interface]
PrivateKey = ${c.privateKey}
Address = ${c.address}

[Peer]
PublicKey = ${c.peerKey}
Endpoint = ${c.host}:${c.port}
AllowedIPs = ${c.allowed}`;
}

export function toLink(c) {
  switch (c.protocol) {
    case 'vless': return vlessLink(c);
    case 'vmess': return vmessLink(c);
    case 'trojan': return trojanLink(c);
    case 'shadowsocks': return ssLink(c);
    case 'hysteria2': return hy2Link(c);
    case 'tuic': return tuicLink(c);
    case 'wireguard': return 'wg-config:' + Buffer.from(wgLink(c)).toString('base64');
    default: return null;
  }
}

// Aggregate a full subscription payload for a user across all enabled nodes.
export function buildSubscription(user, nodes) {
  const out = [];
  for (const node of nodes) {
    if (node.status === 'banned') continue;
    for (const p of protocolsFor(node)) {
      const link = toLink(buildClient(user, node, p));
      if (link) out.push(link);
    }
  }
  return out;
}
