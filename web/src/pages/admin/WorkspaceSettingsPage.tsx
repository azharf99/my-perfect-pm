import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Smartphone,
  Users,
} from 'lucide-react';

export const WorkspaceSettingsPage: React.FC = () => {
  const { organization, refreshMe } = useAuth();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [enforce2FA, setEnforce2FA] = useState(false);
  const [totalMembers, setTotalMembers] = useState(0);
  const [membersWithout2FA, setMembersWithout2FA] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorkspace();
  }, []);

  const loadWorkspace = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/workspace');
      const ws = res.data.workspace;
      setName(ws.name);
      setSlug(ws.slug);
      setEnforce2FA(ws.enforce_2fa || false);
      setTotalMembers(res.data.total_members || 0);
      setMembersWithout2FA(res.data.members_without_2fa || 0);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load workspace settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiClient.patch('/workspace', {
        name: name.trim(),
        enforce_2fa: enforce2FA,
      });

      await refreshMe();
      setSuccess('Workspace settings saved successfully');
      setTimeout(() => setSuccess(null), 4000);
      loadWorkspace();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update workspace settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-slate-400 text-sm">
        Loading workspace settings...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Workspace Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your organization name, tenant slug, and tenant-wide security policies
        </p>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-700" />
          <h2 className="text-sm font-bold text-slate-800">Workspace Information</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Workspace Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Corp"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Tenant Slug (System Identifier)
              </label>
              <input
                type="text"
                disabled
                value={slug}
                className="w-full px-3 py-2 border border-slate-200 bg-slate-100 text-slate-500 font-mono text-xs rounded-lg cursor-not-allowed"
              />
            </div>
          </div>

          {/* Section: 2FA Enforcement */}
          <div className="pt-6 border-t border-slate-200 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-bold text-slate-900">Enforce Two-Factor Authentication</span>
                </div>
                <p className="text-xs text-slate-500 max-w-xl">
                  Require every member of this workspace to configure a TOTP authenticator app before they can view or edit projects.
                </p>
              </div>

              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={enforce2FA}
                  onChange={(e) => setEnforce2FA(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Warning if 2FA is being enabled and some users don't have it */}
            {enforce2FA && membersWithout2FA > 0 && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">
                    {membersWithout2FA} member{membersWithout2FA > 1 ? 's' : ''} in this workspace currently do not have 2FA enabled.
                  </span>
                  <p className="mt-0.5 text-amber-800">
                    Once enforced, these members will immediately be presented with a forced setup screen upon their next interaction.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Workspace Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
