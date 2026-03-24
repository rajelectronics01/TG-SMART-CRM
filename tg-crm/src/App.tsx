import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './core/auth/AuthContext';
import { ProtectedRoute } from './core/auth/ProtectedRoute';
import './index.css';

// Public pages
import LoginPage from './pages/LoginPage';
import ComplaintFormPage from './pages/ComplaintFormPage';
import TrackTicketPage from './pages/TrackTicketPage';
import TicketConfirmationPage from './pages/TicketConfirmationPage';

// Employee/Staff pages
import EmployeeDashboardPage from './pages/EmployeeDashboardPage';
import TicketDetailPage from './pages/TicketDetailPage';

// Manager pages
import ManagerDashboardPage from './pages/ManagerDashboardPage';
import ManagerTicketsPage from './pages/ManagerTicketsPage';
import ManagerTechniciansPage from './pages/ManagerTechniciansPage';

// Admin pages
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminTicketsPage from './pages/AdminTicketsPage';
import AdminEmployeesPage from './pages/AdminEmployeesPage';
import AdminRoutingPage from './pages/AdminRoutingPage';
import AdminReportsPage from './pages/AdminReportsPage';
import AdminSettingsPage from './pages/AdminSettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ─── Public Routes ─── */}
          <Route path="/" element={<Navigate to="/complaint" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/complaint" element={<ComplaintFormPage />} />
          <Route path="/track" element={<TrackTicketPage />} />
          <Route path="/track/:ticketId" element={<TrackTicketPage />} />
          <Route path="/confirmation/:ticketId" element={<TicketConfirmationPage />} />

          {/* ─── Employee/Technician Routes ─── */}
          <Route
            path="/dashboard"
            element={<ProtectedRoute><EmployeeDashboardPage /></ProtectedRoute>}
          />
          <Route
            path="/ticket/:id"
            element={<ProtectedRoute><TicketDetailPage /></ProtectedRoute>}
          />

          {/* ─── Manager Routes ─── */}
          <Route
            path="/manager"
            element={<ProtectedRoute requireManager><ManagerDashboardPage /></ProtectedRoute>}
          />
          <Route
            path="/manager/tickets"
            element={<ProtectedRoute requireManager><ManagerTicketsPage /></ProtectedRoute>}
          />
          <Route
            path="/manager/tickets/:id"
            element={<ProtectedRoute requireManager><TicketDetailPage /></ProtectedRoute>}
          />
          <Route
            path="/manager/technicians"
            element={<ProtectedRoute requireManager><ManagerTechniciansPage /></ProtectedRoute>}
          />

          {/* ─── Admin Routes ─── */}
          <Route
            path="/admin"
            element={<ProtectedRoute requireAdmin><AdminDashboardPage /></ProtectedRoute>}
          />
          <Route
            path="/admin/tickets"
            element={<ProtectedRoute requireAdmin><AdminTicketsPage /></ProtectedRoute>}
          />
          <Route
            path="/admin/tickets/:id"
            element={<ProtectedRoute requireAdmin><TicketDetailPage /></ProtectedRoute>}
          />
          <Route
            path="/admin/employees"
            element={<ProtectedRoute requireAdmin><AdminEmployeesPage /></ProtectedRoute>}
          />
          <Route
            path="/admin/routing"
            element={<ProtectedRoute requireAdmin><AdminRoutingPage /></ProtectedRoute>}
          />
          <Route
            path="/admin/reports"
            element={<ProtectedRoute requireAdmin><AdminReportsPage /></ProtectedRoute>}
          />
          <Route
            path="/admin/settings"
            element={<ProtectedRoute requireAdmin><AdminSettingsPage /></ProtectedRoute>}
          />

          {/* ─── 404 Fallback ─── */}
          <Route path="*" element={<Navigate to="/complaint" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
