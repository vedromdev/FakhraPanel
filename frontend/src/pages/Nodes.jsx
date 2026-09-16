import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Aurora, FadeIn, Modal, Toast } from '../components/ui.jsx';
import { fetcher } from '../lib/fetcher.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Nodes() {
  const { token } = useAuth();
  const h = { headers: { Authorization: `Bearer ${token}` } };
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', flag: '🏳️', country: '', public_host: '', capability: 'vps', sni: '' });
  const [toast, setToast] = useState('');

  const { data: nodes } = useQuery({
    queryKey: ['nodes', token],
    queryFn: () => fetcher('/api/nodes', h).then(r => r.json()),
    refetchInterval: 10000,
  });

  const addNode = useMutation({
    mutationFn: (data) => fetch('/api/nodes', { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries('nodes'); setShowAdd(false); setToast('Node added'); },
  });

  const deployNode = async (id) => {
    try {
      const res = await fetch(`/api/nodes/${id}/deploy`, { method: 'POST', headers: h });
      if (!res.ok) throw new Error('Agent offline');
      setToast('Config deployed');
    } catch (e) { setToast('Agent offline — config saved for next connect'); }
  };

  return (
    <>
      <Aurora />
      <div className="ml-64 p-8 pb-20 min-h-screen">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-display glow-text">Nodes</h1>
          <button onClick={() => setShowAdd(true)} className="btn-primary">+ Add Node</button>
        </div>

        <FadeIn>
          <div className="glass p-4">
            <table className="w-full text-sm">
              <thead><tr className="text-slate-400"><th className="text-left py-2">Node</th><th>Host</th><th>Capability</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {(!nodes || nodes.length === 0) && <tr><td colSpan="5" className="py-6 text-center text-slate-500">No nodes yet.</td></tr>}
                {nodes?.map(n => (
                  <tr key={n.id} className="border-t border-white/5">
                    <td className="py-2"><span className="text-xl mr-1">{n.flag}</span>{n.name} {n.country && <span className="text-slate-500">({n.country})</span>}</td>
                    <td className="text-slate-400">{n.public_host || '—'}</td>
                    <td>{n.capability}</td>
                    <td><span className={`badge ${n.status === 'online' ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/30'}`}>● {n.status}</span></td>
                    <td className="text-right"><button onClick={() => deployNode(n.id)} className="btn-ghost btn-sm">Deploy</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeIn>

        <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Node">
          <div className="space-y-4">
            <input className="input" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Flag / Country" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
            <input className="input" placeholder="Public Host" value={form.public_host} onChange={e => setForm({ ...form, public_host: e.target.value })} />
            <select className="input" value={form.capability} onChange={e => setForm({ ...form, capability: e.target.value })}>
              <option value="vps">VPS (full)</option>
              <option value="railway">Railway (WS only)</option>
            </select>
            <button className="btn-primary w-full" onClick={() => addNode.mutate(form)}>Create</button>
          </div>
        </Modal>
        <Toast message={toast} show={!!toast} onDone={() => setToast('')} />
      </div>
    </>
  );
}
