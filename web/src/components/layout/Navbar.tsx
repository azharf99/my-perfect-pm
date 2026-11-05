import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Layers,
  Plus,
  LogOut,
  ChevronDown,
  Building2,
  Shield,
  User as UserIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface NavbarProps {
  onOpenCreateIssue: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCreateIssue }) => {
  const { user, organization, organizations, role, logout, switchOrganization } = useAuth();
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Brand & Workspace Switcher */}
      <div className="flex items-center gap-6">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm tracking-tight text-slate-900 flex items-center gap-1.5">
              My Perfect PM
              <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.2 rounded uppercase">
                Agile
              </span>
            </span>
          </div>
        </Link>

        {/* Workspace Dropdown */}
        {organization && (
          <div className="relative">
            <button
              onClick={() => setShowOrgDropdown(!showOrgDropdown)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>{organization.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showOrgDropdown && (
              <div className="absolute left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50">
                <div className="px-3 py-2 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Workspaces (Tenants)
                </div>
                {organizations.map((m) => (
                  <button
                    key={m.organization_id}
                    onClick={() => {
                      if (m.organization) switchOrganization(m.organization);
                      setShowOrgDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 ${
                      m.organization_id === organization.id ? 'bg-blue-50/70 font-bold text-blue-600' : 'text-slate-700'
                    }`}
                  >
                    <span>{m.organization?.name}</span>
                    <span className="text-[10px] capitalize px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                      {m.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Global Action & Profile */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenCreateIssue}
          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Create Issue</span>
        </button>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-blue-200 transition-all"
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name}
                className="w-8 h-8 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                {user?.full_name?.charAt(0) || <UserIcon className="w-4 h-4" />}
              </div>
            )}
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="font-bold text-sm text-slate-800">{user?.full_name}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-blue-600">
                  <Shield className="w-3 h-3" /> Role: {role || 'Member'}
                </div>
              </div>

              <button
                onClick={logout}
                className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
