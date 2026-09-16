import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('azadi_token'));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (token) {
      localStorage.setItem('azadi_token', token);
      const payload = JSON.parse(atob(token.split('.')[1] || '{}'));
      setUser({ username: payload.username || 'admin' });
    } else { localStorage.removeItem('azadi_token'); }
  }, [token]);

  const login = async (username, password) => {
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }) });
    if (!res.ok) throw new Error('Login failed');
    const data = await res.json();
    setToken(data.token);
  };

  const logout = () => setToken(null);

  return React.createElement(AuthContext.Provider, { value: { token, user, login, logout } }, children);
}

export const useAuth = () => { const c = useContext(AuthContext); if (!c) throw new Error('no auth'); return c; };
export const requireAuth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

import React from 'react';
