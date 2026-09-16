import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Aurora, FadeIn, Modal, Toast } from '../components/ui.jsx';
import { fetcher } from '../lib/fetcher.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Users() {
  const { token } = useAuth();
  const h = { headers: { Authorization: `Bearer ${token}` } };
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', data_limit_gb: 500, expires_at: '', nodes: [] });
  const [toast, setToast] = useState('');

  const { data: users } = useQuery({
    queryKey: ['users', token],
    queryFn: () => fetcher('/api/users', h).then(r => r.json()),
  });

  const { data: nodes } = useQuery({
    queryKey: ['nodes', token],
    queryFn: () => fetcher('/api/nodes', h).then(r => r.json()),
  });

  const addUser = useMutation({
    mutationFn: (data) => fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries('users'); setShowAdd(false); setToast('User created'); },
  });

  return (
    <>
      <Aurora />
      <div className="ml-64 p-8 pb-20 min-h-screen">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-display glow-text">Users</h1>
          <button onClick={() => setShowAdd(true)} className="btn-primary">+ Add User</button>
        </div>

        <FadeIn>
          <div className="glass p-4">
            <table className="w-full text-sm">
              <thead><tr className="text-slate-400">
                <th className="text-left py-2">User</th><th>UUID / Token</th><th>Usage</th><th>Limit</th><th>Expires</th><th>Status</th>
              </tr></thead>
              <tbody>
                {(!users || users.length === 0) && <tr><td colSpan="6" className="py-6 text-center text-slate-500">No users yet.</td></tr>}
                {users?.map(u => (
                  <tr key={u.id} className="border-t border-white/5">
                    <td className="py-2 font-medium">{u.name}</td>
                    <td className="text-xs text-slate-400 break-all">{u.sub_token?.slice(0,12)}…</td>
                    <td>{u.usage_gb} GB</td>
                    <td>{u.data_limit_gb || '∞'}</td>
                    <td>{u.expires_at ? new Date(u.expires_at * 1000).toLocaleDateString() : 'Never'}</td>
                    <td><span className={`badge ${u.enabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>● {u.enabled ? 'Active' : 'Disabled'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeIn>

        <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add User">
          <div className="space-y-4">
            <input className="input" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input className="input" type="number" placeholder="Data Limit (GB, 0=unlimited)" value={form.data_limit_gb} onChange={e => setForm({ ...form, data_limit_gb: +e.target.value })} />
            <input className="input" type="date" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value ? Math.floor(new Date(e.target.value).getTime() / 1000) : '' })} />
            <div>
              <label className="text-xs text-slate-500 block mb-1">Assign to Nodes</label>
              <div className="flex flex-wrap gap-2">
                {nodes?.map(n => (
                  <label key={n.id} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={form.nodes.includes(n.id)} onChange={e => {
                      const ns = new Set(form.nodes);
                      e.target.checked ? ns.add(n.id) : ns.delete(n.id);
                      setForm({ ...form, nodes: [...ns] });
                    }} />
                    {n.flag} {n.name}
                  </label>
                ))}
              </div>
            </div>
            <button className="btn-primary w-full" onClick={() => addUser.mutate(form)}>Create User</button>
          </div>
        </Modal>
        <Toast message={toast} show={!!toast} onDone={() => setToast('')} />
      </div>
    </>
  );
}
