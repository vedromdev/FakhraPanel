import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Sidebar() {
  const { logout } = useAuth();
  const loc = useLocation();
  const links = [
    { to: '/', label: 'Dashboard', icon: '📊' },
    { to: '/nodes', label: 'Nodes', icon: '🌍' },
    { to: '/users', label: 'Users', icon: '👥' },
    { to: '/protocols', label: 'Protocols', icon: '🔐' },
    { to: '/settings', label: 'Settings', icon: '⚙️' },
  ];
  return (
    <nav className="fixed top-0 left-0 h-screen w-64 glass p-5 flex flex-col z-40">
      <div className="text-2xl font-display glow-text mb-8">Azadi Panel</div>
      {links.map(l => (
        <NavLink key={l.to} to={l.to}
          className={`mb-3 px-3 py-2 rounded-xl transition-all flex items-center gap-3
            ${loc.pathname === l.to ? 'bg-glow/20 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
          <span className="text-lg">{l.icon}</span> {l.label}
        </NavLink>
      ))}
      <button onClick={logout} className="mt-auto btn-ghost">Sign Out</button>
    </nav>
  );
}
