import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { BoardPage } from './pages/BoardPage';
import { BacklogPage } from './pages/BacklogPage';
import { ProjectSettingsPage } from './pages/ProjectSettingsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProfilePage } from './pages/account/ProfilePage';
import { SecurityPage } from './pages/account/SecurityPage';
import { ChangePasswordRequiredPage } from './pages/account/ChangePasswordRequiredPage';
import { Setup2FARequiredPage } from './pages/account/Setup2FARequiredPage';
import { MembersPage } from './pages/admin/MembersPage';
import { WorkspaceSettingsPage } from './pages/admin/WorkspaceSettingsPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold tracking-wider uppercase text-slate-400">
            Initializing My Perfect PM...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Enforce mandatory password update
  if (user.must_change_password && location.pathname !== '/account/change-password-required') {
    return <Navigate to="/account/change-password-required" replace />;
  }

  // Enforce workspace 2FA setup
  if (user.must_setup_2fa && location.pathname !== '/account/setup-2fa-required') {
    return <Navigate to="/account/setup-2fa-required" replace />;
  }

  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role } = useAuth();

  if (role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Forced Security Flow Routes (Requires Auth but outside main AppLayout) */}
          <Route
            path="/account/change-password-required"
            element={
              <ProtectedRoute>
                <ChangePasswordRequiredPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account/setup-2fa-required"
            element={
              <ProtectedRoute>
                <Setup2FARequiredPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Application Workspace */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:projectId/board" element={<BoardPage />} />
            <Route path="projects/:projectId/backlog" element={<BacklogPage />} />
            <Route path="projects/:projectId/settings" element={<ProjectSettingsPage />} />

            {/* User Account & Security */}
            <Route path="account/profile" element={<ProfilePage />} />
            <Route path="account/security" element={<SecurityPage />} />

            {/* Admin Management */}
            <Route
              path="admin/members"
              element={
                <AdminRoute>
                  <MembersPage />
                </AdminRoute>
              }
            />
            <Route
              path="admin/workspace"
              element={
                <AdminRoute>
                  <WorkspaceSettingsPage />
                </AdminRoute>
              }
            />
          </Route>

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
