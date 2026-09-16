// Config generators: turn (node, users) into xray / hysteria2 configs that the
// agent runs on the remote server. Clients identify users by email "u<id>@azadi"
// so per-user traffic stats map back to panel users.
//
// Railway nodes: edge forwards only HTTP/WS and gives ONE public port →
//   one xray inbound on $PORT, ws-only (vless+vmess+trojan share paths).
// VPS nodes: full port range → reality, hysteria2, ss, tuic, wireguard mesh.

import { createHash } from 'node:crypto';
import { secretsFor } from './protocols.js';

export const userTag = (id) => `u${id}@azadi`;

function clientsFor(users, proto, extra = () => ({})) {
  return users.filter(u => u.enabled).map(u => ({
    id: secretsFor(u, proto).id, email: userTag(u.id), level: 1, ...extra(u),
  }));
}

function trojanClients(users) {
  return users.filter(u => u.enabled).map(u => ({
    password: secretsFor(u, 'trojan').password, email: userTag(u.id), level: 1,
  }));
}

export function xrayConfig(node, users, statsPort = 18000) {
  const railway = node.capability === 'railway';
  const sni = node.sni || node.public_host;
  const base = Number(node.port_base || 40000);
  const vless = clientsFor(users, 'vless');
  const vmess = clientsFor(users, 'vmess', () => ({ alterId: 0, security: 'auto' }));
  const trojan = trojanClients(users);

  const inbounds = [];
  const outbounds = [
    { protocol: 'freedom', tag: 'direct' },
    { protocol: 'blackhole', tag: 'block', settings: { response: { type: 'none' } } },
  ];
  const rules = [{ type: 'field', inboundTag: ['api-in'], outboundTag: 'api' }];

  if (railway) {
    // Single edge-forwarded port; transports must be WS (TLS is terminated by Railway).
    const port = Number(process.env.AGENT_LISTEN_PORT || 443);
    const ws = (path) => ({ network: 'ws', security: 'none', wsSettings: { path } });
    if (vless.length) inbounds.push({ tag: 'vless-ws', listen: '0.0.0.0', port, protocol: 'vless',
      settings: { clients: vless, decryption: 'none' }, streamSettings: ws('/vless') });
    if (vmess.length) inbounds.push({ tag: 'vmess-ws', listen: '0.0.0.0', port, protocol: 'vmess',
      settings: { clients: vmess }, streamSettings: ws('/vmess') });
    if (trojan.length) inbounds.push({ tag: 'trojan-ws', listen: '0.0.0.0', port, protocol: 'trojan',
      settings: { clients: trojan }, streamSettings: ws('/trojan') });
  } else {
    if (node.reality_key && vless.length) inbounds.push({
      tag: 'vless-reality', listen: '0.0.0.0', port: base, protocol: 'vless',
      settings: { clients: vless.map(c => ({ ...c, flow: 'xtls-rprx-vision' })), decryption: 'none' },
      streamSettings: { network: 'tcp', security: 'reality',
        realitySettings: { show: 'none', dest: 'www.speedtest.net:443', xver: 1,
          serverNames: ['www.speedtest.net'], privateKey: node.reality_key, shortIds: [node.sid || ''] } },
      sniffing: { enabled: true, destOverride: ['http', 'tls'] },
    });
    if (vless.length) inbounds.push({
      tag: 'vless-ws', listen: '0.0.0.0', port: base + 2, protocol: 'vless',
      settings: { clients: vless, decryption: 'none' },
      streamSettings: { network: 'ws', security: 'tls',
        tlsSettings: { certificates: [{ certFile: node.cert_file, keyFile: node.key_file }], serverName: sni },
        wsSettings: { path: '/vless', headers: { Host: sni } } } });
    if (vmess.length) inbounds.push({
      tag: 'vmess-ws', listen: '0.0.0.0', port: base + 100, protocol: 'vmess',
      settings: { clients: vmess },
      streamSettings: { network: 'ws', security: 'tls',
        tlsSettings: { certificates: [{ certFile: node.cert_file, keyFile: node.key_file }], serverName: sni },
        wsSettings: { path: '/vmess', headers: { Host: sni } } } });
    if (trojan.length) inbounds.push({
      tag: 'trojan-ws', listen: '0.0.0.0', port: base + 200, protocol: 'trojan',
      settings: { clients: trojan },
      streamSettings: { network: 'ws', security: 'tls',
        tlsSettings: { certificates: [{ certFile: node.cert_file, keyFile: node.key_file }], serverName: sni },
        wsSettings: { path: '/trojan', headers: { Host: sni } } } });
    for (const u of users.filter(x => x.enabled)) {
      const s = secretsFor(u, 'shadowsocks');
      inbounds.push({ tag: `ss-${u.id}`, listen: '0.0.0.0', port: base + 300 + (u.id % 99),
        protocol: 'shadowsocks', settings: { method: s.method, password: s.password, network: 'tcp,udp' } });
    }
  }

  // Mesh / chained exits: user traffic leaves through another panel node (vless-ws hop)
  for (const chain of node.chains || []) {
    outbounds.push({
      tag: `exit-${chain.exit_node_id}`, protocol: 'vless',
      settings: { vnext: [{ address: chain.exit_host, port: 443,
        users: [{ id: chain.uuid, encryption: 'none', level: 1 }] }] },
      streamSettings: { network: 'ws', security: 'tls',
        tlsSettings: { serverName: chain.exit_sni, fingerprint: 'chrome' },
        wsSettings: { path: '/vless', headers: { Host: chain.exit_host } } },
    });
    rules.push({ type: 'field', user: [userTag(chain.user_id)], outboundTag: `exit-${chain.exit_node_id}` });
  }

  inbounds.push({ tag: 'api-in', listen: '127.0.0.1', port: railway ? statsPort + 1 : statsPort,
    protocol: 'dokodemo-door', settings: { address: '127.0.0.1', network: 'tcp' } });

  return {
    log: { loglevel: 'warning' },
    stats: {},
    api: { tag: 'api', services: ['StatsService'] },
    policy: { levels: { 1: { handshakeLimit: 16, connIdle: 120, trafficDetector: true } },
      system: { statsUserIncoming: true, statsUserOutgoing: true } },
    inbounds, outbounds,
    routing: { domainStrategy: 'IPIfNonMatch', rules },
  };
}

export function hysteriaConfig(node, users) {
  if (node.capability === 'railway') return null; // QUIC can't traverse the Railway edge
  const usersBlock = users.filter(u => u.enabled).map(u => ({
    name: userTag(u.id), password: secretsFor(u, 'hysteria2').password,
  }));
  if (!usersBlock.length) return null;
  return {
    listen: `0.0.0.0:${Number(node.port_base || 40000) + 700}`,
    tls: { cert: node.cert_file, key: node.key_file },
    bandwidth: { up: node.bandwidth_up || '100mbps', down: node.bandwidth_down || '200mbps' },
    auth: { type: 'users', users: usersBlock },
    ...(node.sid ? { obfs: { type: 'salamander', password: createHash('sha256').update(node.sid).digest('hex').slice(0, 32) } } : {}),
    quic: { maxUDPDatagramSize: 1450, concurrency: 64 },
  };
}

// WireGuard mesh between our own VPS nodes — shared 10.77.0.0/24 plan so every
// node can relay to every other node (one logical network, many locations).
export function wgMeshConfig(node, allNodes) {
  if (!node.wg_priv) return null;
  const peers = allNodes.filter(n => n.wg_pub && n.id !== node.id && n.status !== 'banned');
  const lines = ['[Interface]', `PrivateKey = ${node.wg_priv}`, `Address = ${node.wg_ip}/24`,
    `ListenPort = ${node.wg_port || 51820}`];
  for (const p of peers) {
    lines.push('', '[Peer]', `PublicKey = ${p.wg_pub}`, `AllowedIPs = ${p.wg_ip}/32,10.77.0.0/24`,
      p.public_host && p.capability === 'vps' ? `Endpoint = ${p.public_host}:${p.wg_port || 51820}` : 'PersistentKeepalive = 25');
  }
  return lines.join('\n') + '\n';
}
