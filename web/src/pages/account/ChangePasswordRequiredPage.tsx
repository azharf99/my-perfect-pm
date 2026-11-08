import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/client';
import { ShieldAlert, KeyRound, CheckCircle2, AlertCircle, LogOut, ArrowRight } from 'lucide-react';

export const ChangePasswordRequiredPage: React.FC = () => {
  const { user, refreshMe, logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Policy checks
  const hasLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasDigit = /[0-9]/.test(newPassword);
  const isMatch = newPassword === confirmPassword && newPassword.length > 0;
  const isValid = hasLength && hasUpper && hasLower && hasDigit && isMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setIsLoading(true);
    setError(null);

    try {
      await apiClient.post('/account/password', {
        current_password: currentPassword,
        new_password: newPassword,
      });

      await refreshMe();
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="mt-4 text-center text-2xl font-black text-white tracking-tight">
          Password Update Required
        </h1>
        <p className="mt-1 text-center text-xs text-slate-400">
          Hi {user?.full_name || 'there'}, your account requires a new password before accessing your workspace.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-200">
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Current / Temporary Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Checklist */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <span className="font-bold text-slate-700 block">Security Policy:</span>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <span className={`flex items-center gap-1 ${hasLength ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                  <CheckCircle2 className="w-3 h-3" /> 8+ Characters
                </span>
                <span className={`flex items-center gap-1 ${hasUpper ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                  <CheckCircle2 className="w-3 h-3" /> Uppercase
                </span>
                <span className={`flex items-center gap-1 ${hasLower ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                  <CheckCircle2 className="w-3 h-3" /> Lowercase
                </span>
                <span className={`flex items-center gap-1 ${hasDigit ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                  <CheckCircle2 className="w-3 h-3" /> Digit
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !isValid}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{isLoading ? 'Updating...' : 'Set Password & Continue'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-200 flex justify-center">
            <button
              onClick={logout}
              className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
