import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import ActivationPage from './pages/ActivationPage';
import api from './services/api';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import POSPage from './pages/POSPage';
import ProductsPage from './pages/ProductsPage';
import CategoriesPage from './pages/CategoriesPage';
import InventoryPage from './pages/InventoryPage';
import PurchasesPage from './pages/PurchasesPage';
import ExpensesPage from './pages/ExpensesPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import ActivityLogsPage from './pages/ActivityLogsPage';
import AccountingPage from './pages/AccountingPage';
import ChartOfAccountsPage from './pages/ChartOfAccountsPage';
import CustomersPage from './pages/CustomersPage';
import InvoicesPage from './pages/InvoicesPage';

function App() {
  const [licenseChecked, setLicenseChecked] = useState(false);
  const [isActivated, setIsActivated] = useState(false);

  useEffect(() => {
    checkLicense();
  }, []);

  const checkLicense = async () => {
    try {
      const res = await api.get('/license/status');
      setIsActivated(res.data.data.activated);
    } catch (err) {
      // If license endpoint fails, assume not activated
      setIsActivated(false);
    } finally {
      setLicenseChecked(true);
    }
  };

  // Show loading while checking license
  if (!licenseChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-coffee-950 via-espresso-800 to-coffee-900">
        <div className="w-10 h-10 border-4 border-coffee-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show activation page if not activated
  if (!isActivated) {
    return (
      <>
        <Toaster 
          position="top-center" 
          toastOptions={{
            style: {
              fontFamily: "'Cairo', sans-serif",
              direction: 'rtl',
              background: '#333',
              color: '#fff',
              zIndex: 99999,
            },
            success: { style: { background: '#16A34A' } },
            error: { style: { background: '#DC2626' } },
          }} 
        />
        <ActivationPage onActivated={() => setIsActivated(true)} />
      </>
    );
  }

  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Toaster 
          position="top-center" 
          toastOptions={{
            style: {
              fontFamily: "'Cairo', sans-serif",
              direction: 'rtl',
              background: '#333',
              color: '#fff',
              zIndex: 99999,
            },
            success: {
              style: {
                background: '#16A34A',
              },
            },
            error: {
              style: {
                background: '#DC2626',
              },
            },
          }} 
        />
        
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* Default Route */}
          <Route path="/" element={<Navigate to="/pos" replace />} />

          {/* Protected Routes - All Users (Cashiers) */}
          <Route path="/pos" element={<ProtectedRoute><AppLayout><POSPage /></AppLayout></ProtectedRoute>} />
          <Route path="/invoices" element={<ProtectedRoute><AppLayout><InvoicesPage /></AppLayout></ProtectedRoute>} />

          {/* Protected Routes - Admin Only */}
          <Route path="/dashboard" element={<ProtectedRoute requireAdmin><AppLayout><DashboardPage /></AppLayout></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute requireAdmin><AppLayout><ProductsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/categories" element={<ProtectedRoute requireAdmin><AppLayout><CategoriesPage /></AppLayout></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute requireAdmin><AppLayout><InventoryPage /></AppLayout></ProtectedRoute>} />
          <Route path="/purchases" element={<ProtectedRoute requireAdmin><AppLayout><PurchasesPage /></AppLayout></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute requireAdmin><AppLayout><ExpensesPage /></AppLayout></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute requireAdmin><AppLayout><ReportsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/accounting" element={<ProtectedRoute requireAdmin><AppLayout><AccountingPage /></AppLayout></ProtectedRoute>} />
          <Route path="/chart-of-accounts" element={<ProtectedRoute requireAdmin><AppLayout><ChartOfAccountsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><AppLayout><CustomersPage /></AppLayout></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute requireAdmin><AppLayout><UsersPage /></AppLayout></ProtectedRoute>} />
          <Route path="/activity-logs" element={<ProtectedRoute requireAdmin><AppLayout><ActivityLogsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute requireAdmin><AppLayout><SettingsPage /></AppLayout></ProtectedRoute>} />

          {/* Catch All */}
          <Route path="*" element={<Navigate to="/pos" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
