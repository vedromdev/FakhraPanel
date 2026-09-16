import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext.jsx';
import Cursor from './components/Cursor.jsx';
import App from './App.jsx';
import './index.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: 1 } } });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Cursor />
          <App />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
