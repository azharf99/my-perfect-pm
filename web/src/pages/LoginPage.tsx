import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Layers,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  KeyRound,
  Smartphone,
  ShieldAlert,
  ArrowLeft,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, login2FA } = useAuth();
  const navigate = useNavigate();

  // Step 1: Credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2: Two-Factor
  const [isMFAStep, setIsMFAStep] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await login(email, password);
      if (result.mfa_required) {
        setIsMFAStep(true);
        setMfaCode('');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to sign in. Please verify your email and password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitMFA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await login2FA(mfaCode.trim(), isRecoveryMode);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid authentication code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseDemo = () => {
    setEmail('admin@myperfectpm.local');
    setPassword('Admin123!!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/30">
          <Layers className="w-7 h-7" />
        </div>
        <h1 className="mt-4 text-2xl font-black text-white tracking-tight">My Perfect PM</h1>
        <p className="mt-1 text-xs text-slate-400">
          High-performance Agile & Multi-Project Management Suite
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-200">
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isMFAStep ? (
            <>
              <h2 className="text-lg font-bold text-slate-900 mb-6 text-center">
                Sign in to your workspace
              </h2>

              {/* Quick Demo Fill Banner */}
              <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-blue-900 font-medium">
                  <KeyRound className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Use seeded Demo Admin credentials</span>
                </div>
                <button
                  type="button"
                  onClick={handleUseDemo}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-white px-2.5 py-1 rounded shadow-2xs border border-blue-200"
                >
                  Fill Demo
                </button>
              </div>

              <form onSubmit={handleSubmitCredentials} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isLoading ? 'Signing in...' : 'Sign In'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>

              <div className="mt-6 pt-6 border-t border-slate-200 text-center">
                <p className="text-xs text-slate-500">
                  Need a new workspace?{' '}
                  <Link to="/register" className="font-bold text-blue-600 hover:text-blue-800">
                    Register workspace
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Step 2: 2FA Authentication */}
              <div className="text-center mb-6">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-2">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  Two-Factor Authentication
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {isRecoveryMode
                    ? 'Enter one of your 8-character emergency recovery codes'
                    : 'Enter the 6-digit code from your authenticator app'}
                </p>
              </div>

              <form onSubmit={handleSubmitMFA} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                    {isRecoveryMode ? 'Emergency Recovery Code' : '6-Digit One-Time Code'}
                  </label>
                  <input
                    type="text"
                    autoFocus
                    required
                    maxLength={isRecoveryMode ? 16 : 6}
                    value={mfaCode}
                    onChange={(e) =>
                      setMfaCode(
                        isRecoveryMode
                          ? e.target.value.toLowerCase()
                          : e.target.value.replace(/\D/g, '')
                      )
                    }
                    placeholder={isRecoveryMode ? 'e.g. a1b2c3d4' : '123456'}
                    className={`w-full px-3 py-2.5 border border-slate-300 rounded-lg font-mono text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isRecoveryMode ? 'text-base tracking-wider' : 'text-xl tracking-widest'
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !mfaCode.trim()}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isLoading ? 'Verifying...' : 'Verify Code & Sign In'}
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecoveryMode(!isRecoveryMode);
                      setMfaCode('');
                      setError(null);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {isRecoveryMode
                      ? '← Use 6-digit authenticator code instead'
                      : 'Use emergency recovery backup code'}
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-200 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMFAStep(false);
                      setMfaCode('');
                      setError(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Double-Cookie JWT • Anti-CSRF Protected • Pure-Go Engine</span>
        </div>
      </div>
    </div>
  );
};
