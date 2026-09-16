import db from '../db.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'azadi-admin-change-me';
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

export function ensureAdmin() {
  const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(ADMIN_USER);
  if (!existing) {
    db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)')
      .run(ADMIN_USER, bcrypt.hashSync(ADMIN_PASS, 10));
  }
}

export function verifyAdmin(username, password) {
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password || '', admin.password_hash)) return null;
  return admin;
}

export function createSession(adminId) {
  const token = randomUUID();
  db.prepare('INSERT INTO sessions (token, admin_id, expires_at) VALUES (?, ?, ?)')
    .run(token, adminId, Math.floor(Date.now() / 1000) + SESSION_TTL);
  return token;
}

export function verifySession(token) {
  const s = db.prepare('SELECT admin_id, expires_at FROM sessions WHERE token = ?').get(token);
  if (!s || s.expires_at < Math.floor(Date.now() / 1000)) return null;
  return s.admin_id;
}

export function authHook(req, reply, done) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : (req.cookies && req.cookies.token);
  const adminId = token ? verifySession(token) : null;
  if (!adminId) return reply.code(401).send({ error: 'unauthorized' });
  req.admin_id = adminId;
  done();
}
