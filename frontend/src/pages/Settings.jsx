import { useState, useEffect } from 'react';
import { Aurora, FadeIn, Modal, Toast } from '../components/ui.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../lib/fetcher.jsx';

export default function Settings() {
  const { token } = useAuth();
  const { headers } = api(token);
  const [settings, setSettings] = useState({});
  const [showToast, setShowToast] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings', { headers }).then(r => r.json()).then(d => { setSettings(d); setLoading(false); });
  }, [token]);

  const save = async () => {
    await fetch('/api/settings', { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
    setShowToast('Settings saved');
  };

  const known = [
    { key: 'ADMIN_USER', label: 'Admin Username', type: 'text' },
    { key: 'AGENT_SHARED_SECRET', label: 'Agent Shared Secret', type: 'password' },
    { key: 'DEFAULT_DOMAIN', label: 'Default Domain', type: 'text' },
  ];

  return (
    <>
      <Aurora />
      <div className="ml-64 p-8 pb-20 min-h-screen">
        <FadeIn>
          <h1 className="text-3xl font-display glow-text mb-6">Settings</h1>
        </FadeIn>
        <div className="glass p-6 max-w-2xl">
          {loading ? <p className="text-slate-400">Loading…</p> : (
            <div className="space-y-4">
              {known.map(k => (
                <div key={k.key}>
                  <label className="text-xs text-slate-500 block mb-1">{k.label}</label>
                  <input className="input" type={k.type}
                    value={settings[k.key] || ''}
                    onChange={e => setSettings({ ...settings, [k.key]: e.target.value })} />
                </div>
              ))}
              <button onClick={save} className="btn-primary mt-4">Save Settings</button>
            </div>
          )}
        </div>
        <Toast message={showToast} show={!!showToast} onDone={() => setShowToast('')} />
      </div>
    </>
  );
}
