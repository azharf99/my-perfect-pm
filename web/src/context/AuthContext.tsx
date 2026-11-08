import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { User, Organization, OrganizationMember } from '../api/types';

interface LoginResult {
  mfa_required: boolean;
}

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  organizations: OrganizationMember[];
  role: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  login2FA: (code: string, isRecoveryCode?: boolean) => Promise<void>;
  register: (email: string, password: string, fullName: string, workspaceName: string) => Promise<void>;
  logout: () => Promise<void>;
  switchOrganization: (org: Organization) => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationMember[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshMe = async () => {
    const res = await apiClient.get('/auth/me');
    setUser(res.data.user);
    setOrganization(res.data.organization);
    setOrganizations(res.data.organizations || []);
    setRole(res.data.role);
    if (res.data.organization?.id) {
      localStorage.setItem('my_perfect_pm_tenant_id', res.data.organization.id);
    }
  };

  // Initialize CSRF and verify session on load
  useEffect(() => {
    const initAuth = async () => {
      try {
        await apiClient.get('/auth/csrf');
        await refreshMe();
      } catch (err) {
        setUser(null);
        setOrganization(null);
        setOrganizations([]);
        setRole(null);
        localStorage.removeItem('my_perfect_pm_tenant_id');
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const res = await apiClient.post('/auth/login', { email, password });
    if (res.data.mfa_required) {
      return { mfa_required: true };
    }
    await refreshMe();
    return { mfa_required: false };
  };

  const login2FA = async (code: string, isRecoveryCode?: boolean) => {
    const payload = isRecoveryCode ? { recovery_code: code.trim() } : { code: code.trim() };
    await apiClient.post('/auth/login/2fa', payload);
    await refreshMe();
  };

  const register = async (email: string, password: string, fullName: string, workspaceName: string) => {
    await apiClient.post('/auth/register', {
      email,
      password,
      full_name: fullName,
      workspace_name: workspaceName,
    });
    await refreshMe();
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (_) {}
    setUser(null);
    setOrganization(null);
    setOrganizations([]);
    setRole(null);
    localStorage.removeItem('my_perfect_pm_tenant_id');
  };

  const switchOrganization = async (org: Organization) => {
    localStorage.setItem('my_perfect_pm_tenant_id', org.id);
    try {
      const res = await apiClient.get('/auth/me', {
        headers: { 'X-Tenant-ID': org.id },
      });
      setUser(res.data.user);
      setOrganization(res.data.organization);
      setOrganizations(res.data.organizations || []);
      setRole(res.data.role);
    } catch (err) {
      console.error('Failed to switch workspace', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        organizations,
        role,
        isLoading,
        login,
        login2FA,
        register,
        logout,
        switchOrganization,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
