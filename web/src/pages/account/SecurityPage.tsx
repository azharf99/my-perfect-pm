import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/client';
import { Session, SetupTOTPResponse } from '../../api/types';
import {
  Shield,
  KeyRound,
  Smartphone,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  Trash2,
  RefreshCw,
  LogOut,
  X,
  Lock,
} from 'lucide-react';

export const SecurityPage: React.FC = () => {
  const { user, refreshMe } = useAuth();

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // 2FA state
  const [isSetup2FAModalOpen, setIsSetup2FAModalOpen] = useState(false);
  const [setupData, setSetupData] = useState<SetupTOTPResponse | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [isVerifyingTOTP, setIsVerifyingTOTP] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[] | null>(null);
  const [remainingCodes, setRemainingCodes] = useState<number | null>(null);

  // Disable / Regen modals
  const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);
  const [isRegenModalOpen, setIsRegenModalOpen] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifyingAction, setIsVerifyingAction] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sessionMsg, setSessionMsg] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
    if (user?.totp_enabled) {
      load2FAStatus();
    }
  }, [user]);

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const res = await apiClient.get('/account/sessions');
      setSessions(res.data);
    } catch (_) {
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const load2FAStatus = async () => {
    try {
      const res = await apiClient.get('/account/2fa/recovery-codes/status');
      setRemainingCodes(res.data.remaining);
    } catch (_) {}
  };

  // Password validation checks
  const hasLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasDigit = /[0-9]/.test(newPassword);
  const isMatch = newPassword === confirmPassword && newPassword.length > 0;
  const isPasswordValid = hasLength && hasUpper && hasLower && hasDigit && isMatch;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) return;

    setIsChangingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const res = await apiClient.post('/account/password', {
        current_password: currentPassword,
        new_password: newPassword,
      });

      setPasswordSuccess(res.data.message || 'Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      loadSessions();
      await refreshMe();
      setTimeout(() => setPasswordSuccess(null), 5000);
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // 2FA Setup Flow
  const handleStart2FASetup = async () => {
    setSetupError(null);
    setTotpCode('');
    try {
      const res = await apiClient.post('/account/2fa/setup');
      setSetupData(res.data);
      setIsSetup2FAModalOpen(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to start 2FA setup');
    }
  };

  const handleVerify2FASetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode.trim()) return;

    setIsVerifyingTOTP(true);
    setSetupError(null);

    try {
      const res = await apiClient.post('/account/2fa/enable', {
        code: totpCode.trim(),
      });

      setNewRecoveryCodes(res.data.recovery_codes || []);
      await refreshMe();
      load2FAStatus();
    } catch (err: any) {
      setSetupError(err.response?.data?.error || 'Invalid 6-digit verification code');
    } finally {
      setIsVerifyingTOTP(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifyingAction(true);
    setVerifyError(null);

    try {
      await apiClient.post('/account/2fa/disable', {
        password: verifyPassword,
        code: verifyCode.trim(),
      });

      setIsDisableModalOpen(false);
      setVerifyPassword('');
      setVerifyCode('');
      await refreshMe();
    } catch (err: any) {
      setVerifyError(err.response?.data?.error || 'Failed to disable 2FA');
    } finally {
      setIsVerifyingAction(false);
    }
  };

  const handleRegenerateCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifyingAction(true);
    setVerifyError(null);

    try {
      const res = await apiClient.post('/account/2fa/recovery-codes', {
        password: verifyPassword,
        code: verifyCode.trim(),
      });

      setIsRegenModalOpen(false);
      setVerifyPassword('');
      setVerifyCode('');
      setNewRecoveryCodes(res.data.recovery_codes || []);
      load2FAStatus();
    } catch (err: any) {
      setVerifyError(err.response?.data?.error || 'Failed to regenerate codes');
    } finally {
      setIsVerifyingAction(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await apiClient.delete(`/account/sessions/${sessionId}`);
      setSessions(sessions.filter((s) => s.id !== sessionId));
      setSessionMsg('Session revoked');
      setTimeout(() => setSessionMsg(null), 3000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to revoke session');
    }
  };

  const handleRevokeOtherSessions = async () => {
    if (!confirm('Are you sure you want to sign out from all other devices?')) return;

    try {
      const res = await apiClient.post('/account/sessions/revoke-others');
      setSessionMsg(res.data.message || 'All other devices signed out');
      loadSessions();
      setTimeout(() => setSessionMsg(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to revoke other sessions');
    }
  };

  const copyRecoveryCodes = () => {
    if (!newRecoveryCodes) return;
    navigator.clipboard.writeText(newRecoveryCodes.join('\n'));
    alert('Recovery codes copied to clipboard');
  };

  const downloadRecoveryCodes = () => {
    if (!newRecoveryCodes) return;
    const blob = new Blob([newRecoveryCodes.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-perfect-pm-recovery-codes-${user?.email}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Security & Authentication</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your password, two-factor authentication (TOTP), and active browser sessions
        </p>
      </div>

      {/* SECTION 1: Change Password */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-slate-700" />
          <h2 className="text-sm font-bold text-slate-800">Change Password</h2>
        </div>

        <form onSubmit={handleChangePassword} className="p-6 space-y-5">
          {passwordSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {passwordError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Current Password *
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                New Password *
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Confirm New Password *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Password Policy Hints */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
            <span className="font-bold text-slate-700 block">Password Requirements:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <span className={`flex items-center gap-1 ${hasLength ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" /> 8+ Characters
              </span>
              <span className={`flex items-center gap-1 ${hasUpper ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Uppercase letter
              </span>
              <span className={`flex items-center gap-1 ${hasLower ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Lowercase letter
              </span>
              <span className={`flex items-center gap-1 ${hasDigit ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Numeric digit
              </span>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isChangingPassword || !isPasswordValid}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {isChangingPassword ? 'Updating Password...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: Two-Factor Authentication (TOTP) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-800">Two-Factor Authentication (2FA)</h2>
          </div>
          {user?.totp_enabled ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" /> Enabled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
              Disabled
            </span>
          )}
        </div>

        <div className="p-6 space-y-6">
          <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
            Two-factor authentication adds an extra layer of defense to your account. In addition to your
            password, you will be required to provide a 6-digit one-time code from your authenticator app
            (Google Authenticator, Authy, 1Password, etc.) on login.
          </p>

          {!user?.totp_enabled ? (
            <div>
              <button
                type="button"
                onClick={handleStart2FASetup}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-2"
              >
                <Shield className="w-4 h-4" />
                <span>Configure Two-Factor Authentication</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Emergency Recovery Codes</span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {remainingCodes !== null ? `${remainingCodes} of 10 codes remaining` : 'Keep backup codes safe'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVerifyPassword('');
                      setVerifyCode('');
                      setVerifyError(null);
                      setIsRegenModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Regenerate Codes
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">Need to remove two-factor authentication?</span>
                <button
                  type="button"
                  onClick={() => {
                    setVerifyPassword('');
                    setVerifyCode('');
                    setVerifyError(null);
                    setIsDisableModalOpen(true);
                  }}
                  className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition-colors"
                >
                  Disable 2FA
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: Active Sessions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Laptop className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-800">Active Devices & Sessions</h2>
          </div>
          {sessions.length > 1 && (
            <button
              type="button"
              onClick={handleRevokeOtherSessions}
              className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out Other Devices
            </button>
          )}
        </div>

        {sessionMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
            {sessionMsg}
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {isLoadingSessions ? (
            <div className="p-6 text-center text-xs text-slate-400">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No active sessions found.</div>
          ) : (
            sessions.map((sess) => (
              <div key={sess.id} className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <Laptop className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 truncate max-w-sm">
                        {sess.user_agent || 'Unknown Browser / Platform'}
                      </span>
                      {sess.current && (
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                          Current Device
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                      <span>IP: {sess.ip || 'Localhost'}</span>
                      <span>•</span>
                      <span>Last active: {new Date(sess.last_used_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {!sess.current && (
                  <button
                    type="button"
                    onClick={() => handleRevokeSession(sess.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Revoke session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* MODAL 1: 2FA Setup Modal */}
      {isSetup2FAModalOpen && setupData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-base font-bold text-slate-800">Set Up Two-Factor Authentication</h2>
              <button
                onClick={() => {
                  setIsSetup2FAModalOpen(false);
                  setSetupData(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Step 1: Scan QR Code</span>
                <p className="text-xs text-slate-500">
                  Open your authenticator app (Google Authenticator, Authy, etc.) and scan the barcode:
                </p>
              </div>

              {/* QR Code Display */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <img src={setupData.qr_code} alt="2FA QR Code" className="w-48 h-48 rounded-lg shadow-sm" />
                <div className="mt-3 text-center">
                  <span className="text-[11px] text-slate-400 block mb-1">Or enter manual key:</span>
                  <code className="text-xs font-mono font-bold bg-white px-2 py-1 rounded border border-slate-200 select-all text-slate-800">
                    {setupData.secret}
                  </code>
                </div>
              </div>

              {setupError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{setupError}</span>
                </div>
              )}

              {/* Step 2 Form */}
              <form onSubmit={handleVerify2FASetup} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Step 2: Enter 6-digit Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    required
                    className="w-full text-center tracking-widest font-mono text-lg font-bold px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSetup2FAModalOpen(false);
                      setSetupData(null);
                    }}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifyingTOTP || totpCode.length !== 6}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
                  >
                    {isVerifyingTOTP ? 'Verifying...' : 'Verify & Activate'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Recovery Codes Display Modal */}
      {newRecoveryCodes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-800">Save Your Recovery Codes</h2>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Recovery codes allow you to access your account if you lose your phone or authenticator app.
                Each code can be used only once. Store them in a safe place.
              </p>

              <div className="p-4 bg-slate-900 rounded-xl text-slate-100 font-mono text-xs grid grid-cols-2 gap-2 text-center select-all">
                {newRecoveryCodes.map((code, idx) => (
                  <span key={idx} className="tracking-wider py-1 bg-slate-800 rounded">
                    {code}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyRecoveryCodes}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Codes
                </button>
                <button
                  type="button"
                  onClick={downloadRecoveryCodes}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download .txt
                </button>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setNewRecoveryCodes(null);
                    setIsSetup2FAModalOpen(false);
                    setSetupData(null);
                  }}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                >
                  I Have Saved My Codes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Verify Password & Code for Disable 2FA */}
      {isDisableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-base font-bold text-slate-800">Disable Two-Factor Authentication</h2>
              <button onClick={() => setIsDisableModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDisable2FA} className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                To disable two-factor authentication, please enter your password and a current 6-digit authenticator code.
              </p>

              {verifyError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {verifyError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Password</label>
                <input
                  type="password"
                  value={verifyPassword}
                  onChange={(e) => setVerifyPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">6-Digit Code</label>
                <input
                  type="text"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  required
                  placeholder="123456"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tracking-widest text-center text-base font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsDisableModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingAction || !verifyPassword || verifyCode.length !== 6}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {isVerifyingAction ? 'Disabling...' : 'Confirm Disable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Verify Password & Code for Regenerating Recovery Codes */}
      {isRegenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-base font-bold text-slate-800">Regenerate Recovery Codes</h2>
              <button onClick={() => setIsRegenModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegenerateCodes} className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Regenerating recovery codes will invalidate all existing backup codes. Confirm with your password and a 6-digit code.
              </p>

              {verifyError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {verifyError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Password</label>
                <input
                  type="password"
                  value={verifyPassword}
                  onChange={(e) => setVerifyPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">6-Digit Code</label>
                <input
                  type="text"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  required
                  placeholder="123456"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tracking-widest text-center text-base font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRegenModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingAction || !verifyPassword || verifyCode.length !== 6}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {isVerifyingAction ? 'Regenerating...' : 'Generate New Codes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
