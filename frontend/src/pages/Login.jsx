import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Aurora } from '../components/ui.jsx';
import HeroTypewriter from '../components/HeroTypewriter.jsx';

export default function LoginPage() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Aurora />
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          className="glass p-8 w-full max-w-md relative overflow-hidden"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-display glow-text mb-2">Azadi Panel</h1>
            <p className="text-slate-400 text-sm mb-4">Multi-Protocol VPN Control Center</p>
            <HeroTypewriter />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                className="input" required autoFocus />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="input" required minLength={4} />
            </div>
            {error && <p className="text-rose-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <span className="loading-dot animate-pulse">...</span> : 'Login'}
            </button>
          </form>

          <p className="text-xs text-slate-600 mt-6 text-center">
            Default: admin / {process.env.ADMIN_PASS || 'azadi-admin-change-me'}
          </p>
        </motion.div>
      </div>
    </>
  );
}
