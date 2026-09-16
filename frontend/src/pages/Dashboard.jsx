import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Aurora, StatCard, FadeIn } from '../components/ui.jsx';
import { fetcher } from '../lib/fetcher.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Dashboard() {
  const { token } = useAuth();
  const h = { headers: { Authorization: `Bearer ${token}` } };

  const { data: stats } = useQuery({
    queryKey: ['stats', token],
    queryFn: () => fetcher('/api/stats', h).then(r => r.json()),
    refetchInterval: 3000,
  });

  const { data: nodes } = useQuery({
    queryKey: ['nodes', token],
    queryFn: () => fetcher('/api/nodes', h).then(r => r.json()),
    refetchInterval: 10000,
  });

  return (
    <>
      <Aurora />
      <div className="ml-64 p-8 pb-20 min-h-screen">
        <FadeIn>
          <h1 className="text-3xl font-display glow-text mb-6">Dashboard</h1>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Online Nodes" value={stats?.nodes_online ?? '—'} accent="#7c5cff" icon="🌍" />
          <StatCard label="All Nodes" value={stats?.nodes_total ?? '—'} accent="#22d3ee" icon="🌐" />
          <StatCard label="Users" value={stats?.users_total ?? '—'} accent="#fb7185" icon="👥" />
          <StatCard label="Active" value={stats?.users_total ?? '—'} accent="#a3e635" icon="⚡" />
        </div>

        <FadeIn delay={0.1}>
          <div className="glass p-4 mb-8">
            <h3 className="text-slate-300 mb-4">Connected Nodes</h3>
            <div className="space-y-2">
              {(!nodes || nodes.length === 0) && <p className="text-slate-500 text-sm">No nodes connected. Add one to get started.</p>}
              {nodes?.map((n, i) => (
                <motion.div key={n.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10"
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{n.flag}</span>
                    <div>
                      <div className="font-medium">{n.name} — {n.country || 'Unknown'}</div>
                      <div className="text-xs text-slate-500">{n.public_host || 'No host set'} · {n.capability}</div>
                    </div>
                  </div>
                  <span className={`badge text-xs ${n.status === 'online' ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/30 text-slate-400'}`}>
                    ● {n.status}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </>
  );
}
