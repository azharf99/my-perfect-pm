import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { User, Organization, OrganizationMember } from '../api/types';

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  organizations: OrganizationMember[];
  role: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, workspaceName: string) => Promise<void>;
  logout: () => Promise<void>;
  switchOrganization: (org: Organization) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationMember[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize CSRF and verify session on load
  useEffect(() => {
    const initAuth = async () => {
      try {
        await apiClient.get('/auth/csrf');
        const res = await apiClient.get('/auth/me');
        setUser(res.data.user);
        setOrganization(res.data.organization);
        setOrganizations(res.data.organizations || []);
        setRole(res.data.role);
      } catch (err) {
        setUser(null);
        setOrganization(null);
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password });
    setUser(res.data.user);
    setOrganization(res.data.organization);
    setRole(res.data.role);

    // Refresh organization list
    try {
      const meRes = await apiClient.get('/auth/me');
      setOrganizations(meRes.data.organizations || []);
    } catch (_) {}
  };

  const register = async (email: string, password: string, fullName: string, workspaceName: string) => {
    const res = await apiClient.post('/auth/register', { email, password, full_name: fullName, workspace_name: workspaceName });
    setUser(res.data.user);
    setOrganization(res.data.organization);
    setRole(res.data.role);
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (_) {}
    setUser(null);
    setOrganization(null);
    setOrganizations([]);
    setRole(null);
  };

  const switchOrganization = (org: Organization) => {
    setOrganization(org);
    // Find role in target organization
    const member = organizations.find((m) => m.organization_id === org.id);
    if (member) {
      setRole(member.role);
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
        register,
        logout,
        switchOrganization,
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
