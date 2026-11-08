import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/client';
import { SetupTOTPResponse } from '../../api/types';
import {
  ShieldAlert,
  Smartphone,
  Copy,
  Download,
  AlertCircle,
  ArrowRight,
  LogOut,
  ShieldCheck,
} from 'lucide-react';

export const Setup2FARequiredPage: React.FC = () => {
  const { user, organization, refreshMe, logout } = useAuth();
  const navigate = useNavigate();

  const [setupData, setSetupData] = useState<SetupTOTPResponse | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  useEffect(() => {
    init2FA();
  }, []);

  const init2FA = async () => {
    try {
      const res = await apiClient.post('/account/2fa/setup');
      setSetupData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to initialize 2FA setup');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.trim().length !== 6) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await apiClient.post('/account/2fa/enable', {
        code: totpCode.trim(),
      });

      setRecoveryCodes(res.data.recovery_codes || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid 6-digit code. Please check your authenticator clock.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = async () => {
    await refreshMe();
    navigate('/dashboard', { replace: true });
  };

  const copyCodes = () => {
    if (!recoveryCodes) return;
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    alert('Recovery codes copied to clipboard');
  };

  const downloadCodes = () => {
    if (!recoveryCodes) return;
    const blob = new Blob([recoveryCodes.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-perfect-pm-recovery-codes-${user?.email}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mx-auto">
          <Smartphone className="w-6 h-6" />
        </div>
        <h1 className="mt-4 text-center text-2xl font-black text-white tracking-tight">
          2FA Setup Required
        </h1>
        <p className="mt-1 text-center text-xs text-slate-400">
          The workspace <span className="font-bold text-white">"{organization?.name}"</span> enforces two-factor authentication for all members.
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

          {!recoveryCodes ? (
            <div className="space-y-5">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  1. Scan in Authenticator App
                </span>
                <p className="text-xs text-slate-500">
                  Scan this QR barcode with Google Authenticator, Authy, or 1Password:
                </p>
              </div>

              {setupData ? (
                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <img src={setupData.qr_code} alt="TOTP QR Code" className="w-44 h-44 rounded-lg shadow-xs" />
                  <div className="mt-2 text-center">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Secret Key:</span>
                    <code className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200 select-all text-slate-800">
                      {setupData.secret}
                    </code>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-slate-400">Loading QR code...</div>
              )}

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    2. Enter 6-digit Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    required
                    className="w-full text-center tracking-widest font-mono text-xl font-bold px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || totpCode.length !== 6}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span>{isLoading ? 'Verifying...' : 'Verify Code & Enable'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-emerald-700">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="font-bold text-sm">Two-Factor Enabled!</h3>
              </div>
              <p className="text-xs text-slate-600">
                Save these emergency recovery codes in a secure place. If you ever lose your phone, you can use these to log in:
              </p>

              <div className="p-3.5 bg-slate-900 rounded-xl text-slate-100 font-mono text-xs grid grid-cols-2 gap-2 text-center select-all">
                {recoveryCodes.map((code, idx) => (
                  <span key={idx} className="tracking-wider py-1 bg-slate-800 rounded">
                    {code}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyCodes}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
                <button
                  type="button"
                  onClick={downloadCodes}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
              </div>

              <button
                type="button"
                onClick={handleFinish}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <span>Proceed to Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

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
