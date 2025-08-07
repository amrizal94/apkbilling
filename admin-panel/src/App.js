import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Toaster } from 'react-hot-toast';

import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TVManagement from './pages/TVManagement';
import PackageManagement from './pages/PackageManagement';
import POSSystem from './pages/POSSystem';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import SupplierManagement from './pages/SupplierManagement';
import PurchaseOrders from './pages/PurchaseOrders';
import StockMovements from './pages/StockMovements';
import UserManagement from './pages/UserManagement';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function AppContent() {
  const { isAuthenticated } = useAuth();

  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <Routes>
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/" /> : <Login />} 
        />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <SocketProvider>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/tv-management" element={<TVManagement />} />
                    <Route path="/packages" element={<PackageManagement />} />
                    <Route path="/pos" element={<POSSystem />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/suppliers" element={<SupplierManagement />} />
                    <Route path="/purchases" element={<PurchaseOrders />} />
                    <Route path="/stock-movements" element={<StockMovements />} />
                    <Route path="/user-management" element={<UserManagement />} />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </Layout>
              </SocketProvider>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <AppContent />
        <Toaster position="top-right" />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;