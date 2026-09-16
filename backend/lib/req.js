// lib/req.js — HTTP helper for tests (kept for debugging)
export const req = async (method, urlPath, body, token, host = 'localhost:3000') => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`http://${host}${urlPath}`, { method, headers, body: body ? JSON.stringify(body) : null });
  return { status: res.status, body: await res.text() };
};
