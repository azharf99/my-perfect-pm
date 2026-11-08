import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { OrganizationMember, MemberRole } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  Users,
  UserPlus,
  Shield,
  Smartphone,
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Clock,
  KeyRound,
  Trash2,
  UserCheck,
  UserX,
  X,
  RefreshCw,
} from 'lucide-react';

export const MembersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { isAdmin } = usePermissions();

  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Active row dropdown
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Add Member Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addFullName, setAddFullName] = useState('');
  const [addRole, setAddRole] = useState<MemberRole>('member');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Temp Password Modal
  const [tempPasswordInfo, setTempPasswordInfo] = useState<{
    email: string;
    tempPassword: string;
    message: string;
  } | null>(null);

  // Change Role Modal
  const [roleChangeMember, setRoleChangeMember] = useState<OrganizationMember | null>(null);
  const [selectedRole, setSelectedRole] = useState<MemberRole>('member');
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/members');
      setMembers(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail.trim()) return;

    setIsSubmittingAdd(true);
    setAddError(null);

    try {
      const res = await apiClient.post('/members', {
        email: addEmail.trim(),
        full_name: addFullName.trim() || undefined,
        role: addRole,
      });

      setIsAddModalOpen(false);
      setAddEmail('');
      setAddFullName('');
      setAddRole('member');

      if (res.data.temp_password) {
        setTempPasswordInfo({
          email: res.data.member?.user?.email || addEmail,
          tempPassword: res.data.temp_password,
          message: res.data.message,
        });
      } else {
        setSuccess('Member added to workspace successfully');
        setTimeout(() => setSuccess(null), 4000);
      }

      loadMembers();
    } catch (err: any) {
      setAddError(err.response?.data?.error || 'Failed to add member');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleChangeMember) return;

    setIsSubmittingRole(true);
    try {
      await apiClient.patch(`/members/${roleChangeMember.user_id}`, {
        role: selectedRole,
      });

      setRoleChangeMember(null);
      setSuccess('Role updated successfully');
      setTimeout(() => setSuccess(null), 3000);
      loadMembers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update role');
    } finally {
      setIsSubmittingRole(false);
    }
  };

  const handleResetPassword = async (member: OrganizationMember) => {
    if (!confirm(`Reset password for ${member.user?.email}? A new temporary password will be generated.`)) return;

    try {
      const res = await apiClient.post(`/members/${member.user_id}/reset-password`);
      setTempPasswordInfo({
        email: member.user?.email || '',
        tempPassword: res.data.temp_password,
        message: res.data.message,
      });
      loadMembers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reset password');
    }
  };

  const handleReset2FA = async (member: OrganizationMember) => {
    if (!confirm(`Reset 2FA for ${member.user?.email}? The user will be able to log in without two-factor authentication.`)) return;

    try {
      await apiClient.post(`/members/${member.user_id}/reset-2fa`);
      setSuccess('Two-factor authentication has been reset for this member');
      setTimeout(() => setSuccess(null), 4000);
      loadMembers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reset 2FA');
    }
  };

  const handleToggleActive = async (member: OrganizationMember) => {
    const isActive = member.user?.is_active ?? true;
    const action = isActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} ${member.user?.email}?`)) return;

    try {
      await apiClient.post(`/members/${member.user_id}/${action}`);
      setSuccess(`User has been ${action}d`);
      setTimeout(() => setSuccess(null), 3000);
      loadMembers();
    } catch (err: any) {
      alert(err.response?.data?.error || `Failed to ${action} user`);
    }
  };

  const handleRemoveMember = async (member: OrganizationMember) => {
    if (!confirm(`Are you sure you want to remove ${member.user?.email} from this workspace?`)) return;

    try {
      await apiClient.delete(`/members/${member.user_id}`);
      setSuccess('Member removed from workspace');
      setTimeout(() => setSuccess(null), 3000);
      loadMembers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const copyPassword = () => {
    if (!tempPasswordInfo) return;
    navigator.clipboard.writeText(tempPasswordInfo.tempPassword);
    alert('Temporary password copied to clipboard');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Team Members</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage workspace members, roles (Admin, Member, Viewer), credentials, and security states
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors w-fit"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Member</span>
          </button>
        )}
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

      {/* Members Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-6">User</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">2FA Status</th>
                <th className="py-3.5 px-4">Account Status</th>
                <th className="py-3.5 px-4">Last Login</th>
                {isAdmin && <th className="py-3.5 px-6 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading team members...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No members found.
                  </td>
                </tr>
              ) : (
                members.map((m) => {
                  const u = m.user;
                  const isCurrent = u?.id === currentUser?.id;
                  const isActive = u?.is_active ?? true;

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* User Column */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          {u?.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt={u.full_name}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs shrink-0">
                              {u?.full_name?.charAt(0) || u?.email?.charAt(0) || 'U'}
                            </div>
                          )}
                          <div className="truncate max-w-xs">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{u?.full_name || 'Member'}</span>
                              {isCurrent && (
                                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-slate-500 text-[11px] truncate">{u?.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role Column */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide text-[10px] ${
                            m.role === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : m.role === 'viewer'
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          {m.role}
                        </span>
                      </td>

                      {/* 2FA Status */}
                      <td className="py-4 px-4">
                        {u?.totp_enabled ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                            <Smartphone className="w-3.5 h-3.5" /> Enabled
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Not enabled</span>
                        )}
                      </td>

                      {/* Account Status */}
                      <td className="py-4 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 font-medium text-[11px]">
                            <XCircle className="w-3.5 h-3.5" /> Deactivated
                          </span>
                        )}
                      </td>

                      {/* Last Login */}
                      <td className="py-4 px-4 text-slate-500 text-[11px]">
                        {u?.last_login_at ? (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {new Date(u.last_login_at).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">Never</span>
                        )}
                      </td>

                      {/* Row Actions */}
                      {isAdmin && (
                        <td className="py-4 px-6 text-right relative">
                          <button
                            type="button"
                            onClick={() => setActiveMenuId(activeMenuId === m.id ? null : m.id)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeMenuId === m.id && (
                            <div
                              onClick={() => setActiveMenuId(null)}
                              className="absolute right-6 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-20 text-xs text-left animate-in fade-in duration-150"
                            >
                              {/* Change Role */}
                              <button
                                type="button"
                                onClick={() => {
                                  setRoleChangeMember(m);
                                  setSelectedRole(m.role);
                                }}
                                className="w-full text-left px-3.5 py-1.5 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <Shield className="w-3.5 h-3.5 text-slate-400" />
                                <span>Change Role</span>
                              </button>

                              {/* Reset Password */}
                              <button
                                type="button"
                                onClick={() => handleResetPassword(m)}
                                className="w-full text-left px-3.5 py-1.5 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                                <span>Reset Password</span>
                              </button>

                              {/* Reset 2FA */}
                              {u?.totp_enabled && (
                                <button
                                  type="button"
                                  onClick={() => handleReset2FA(m)}
                                  className="w-full text-left px-3.5 py-1.5 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Reset 2FA</span>
                                </button>
                              )}

                              {/* Toggle Active */}
                              <button
                                type="button"
                                onClick={() => handleToggleActive(m)}
                                className="w-full text-left px-3.5 py-1.5 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                {isActive ? (
                                  <>
                                    <UserX className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Deactivate Account</span>
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Activate Account</span>
                                  </>
                                )}
                              </button>

                              <div className="border-t border-slate-100 my-1" />

                              {/* Remove Member */}
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(m)}
                                className="w-full text-left px-3.5 py-1.5 text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove from Workspace</span>
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Add Member */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-bold text-slate-800">Invite / Add Member</h2>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {addError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddMember} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  value={addFullName}
                  onChange={(e) => setAddFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Workspace Role *
                </label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as MemberRole)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="member">Member (Can create & manage issues, boards, sprints)</option>
                  <option value="admin">Admin (Full administrative control and user management)</option>
                  <option value="viewer">Viewer (Read-only access across the workspace)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd || !addEmail.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {isSubmittingAdd ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Temporary Password Display Modal */}
      {tempPasswordInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-bold text-slate-800">Temporary Password Generated</h2>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                A temporary password was generated for <span className="font-bold text-slate-900">{tempPasswordInfo.email}</span>.
                Provide this password to the user. They will be required to change it on their first login.
              </p>

              <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between">
                <code className="text-sm font-mono font-bold text-slate-900 select-all tracking-wider">
                  {tempPasswordInfo.tempPassword}
                </code>
                <button
                  type="button"
                  onClick={copyPassword}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setTempPasswordInfo(null)}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Change Role Modal */}
      {roleChangeMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-base font-bold text-slate-800">Change Member Role</h2>
              <button onClick={() => setRoleChangeMember(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateRole} className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Update role for <span className="font-bold text-slate-900">{roleChangeMember.user?.email}</span>:
              </p>

              <div className="space-y-2">
                {(['member', 'admin', 'viewer'] as MemberRole[]).map((r) => (
                  <label
                    key={r}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      selectedRole === r ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={selectedRole === r}
                      onChange={() => setSelectedRole(r)}
                      className="text-blue-600"
                    />
                    <div>
                      <span className="font-bold text-xs capitalize text-slate-900 block">{r}</span>
                      <span className="text-[11px] text-slate-500">
                        {r === 'admin'
                          ? 'Full workspace management, project deletion, and team member controls'
                          : r === 'member'
                          ? 'Can create and edit agile issues, sprints, and comment'
                          : 'Read-only access across all projects, boards, and backlog'}
                      </span>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setRoleChangeMember(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRole}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {isSubmittingRole ? 'Saving...' : 'Update Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
