import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Nodes from './pages/Nodes.jsx';
import Users from './pages/Users.jsx';
import Protocols from './pages/Protocols.jsx';
import Settings from './pages/Settings.jsx';

function RequireAuth() {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <div className="ml-64 min-h-screen"><Sidebar /><main className="pt-0"><Outlet /></main></div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/nodes" element={<Nodes />} />
        <Route path="/users" element={<Users />} />
        <Route path="/protocols" element={<Protocols />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
