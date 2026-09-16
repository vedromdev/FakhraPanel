// Glue between the agent control channel + config generation.
// The panel pushes per-node xray/hysteria2/wireguard configs and the agent
// applies them — this is what makes multi-location work.

import db, { getSetting } from '../db.js';
import { xrayConfig, hysteriaConfig, wgMeshConfig } from '../configgen.js';

export const connections = new Map(); // agent_id → ws

export function registerConnection(agentId, ws) {
  connections.set(agentId, ws);
}

export function unregisterConnection(agentId) {
  connections.delete(agentId);
}

export function generateConfigForNode(node) {
  const users = db.prepare(`
    SELECT u.* FROM users u
    JOIN assignments a ON a.user_id = u.id
    WHERE a.node_id = ? AND u.enabled = 1
  `).all(node.id);

  const allNodes = db.prepare('SELECT * FROM nodes').all();
  const xray = xrayConfig(node, users);
  const hy2 = hysteriaConfig(node, users);
  const wg = wgMeshConfig(node, allNodes);

  return { xray, hysteria: hy2, wireguard: wg };
}

export function pushConfig(agentId, config = null) {
  const ws = connections.get(agentId);
  if (!ws || ws.readyState !== ws.OPEN) throw new Error('agent offline');
  const node = db.prepare('SELECT * FROM nodes WHERE agent_id = ?').get(agentId);
  const cfg = config || generateConfigForNode(node);
  ws.send(JSON.stringify({ type: 'apply', payload: cfg }));
  return cfg;
}
