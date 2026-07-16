import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL, normalizePhone } from '../lib/api';

interface LoginFormProps {
  onSuccess: () => void;
  onSwitchToRegister: () => void;
}

type Step = 'login' | 'forgot' | 'reset';

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const { login } = useAuth();
  const [step, setStep] = useState<Step>('login');

  // Login fields
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Forgot / reset fields
  const [forgotPhone, setForgotPhone] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!phone || !password) { setError('Enter your phone number and password.'); return; }
    setLoading(true);
    try {
      await login(normalizePhone(phone), password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials');
    } finally { setLoading(false); }
  };

  // ── Request reset code ─────────────────────────────────────────────────────
  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setInfo('');
    if (!forgotPhone) { setError('Enter your registered phone number.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizePhone(forgotPhone) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to send reset code');
      if (data.code) {
        setInfo(`Your reset code is: ${data.code} (normally sent via SMS)`);
      } else {
        setInfo('Reset code sent. Check your SMS.');
      }
      setStep('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally { setLoading(false); }
  };

  // ── Confirm reset ──────────────────────────────────────────────────────────
  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!resetCode) { setError('Enter the reset code.'); return; }
    if (newPassword.length < 6) { setError('New password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: normalizePhone(forgotPhone),
          code: resetCode,
          newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Reset failed');
      setInfo('');
      setStep('login');
      setPassword('');
      setPhone(forgotPhone);
      setError('');
      // Show brief success via the info line on login screen
      setInfo('Password reset. Sign in with your new password.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally { setLoading(false); }
  };

  const back = () => { setStep('login'); setError(''); setInfo(''); };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (step === 'forgot') {
    return (
      <form onSubmit={handleForgot} className="space-y-4">
        <div className="text-center mb-2">
          <p className="text-sm font-semibold text-slate-800">Forgot your password?</p>
          <p className="text-xs text-slate-500 mt-1">Enter your registered phone number and we'll send a reset code.</p>
        </div>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone Number</label>
          <input
            type="tel" autoFocus placeholder="0700000000"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
            value={forgotPhone} onChange={(e) => setForgotPhone(e.target.value)} required />
        </div>
        <button type="submit" disabled={loading}
          className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-500 disabled:opacity-60">
          {loading ? 'Sending…' : 'Send reset code'}
        </button>
        <p className="text-center text-sm">
          <button type="button" onClick={back} className="text-slate-500 hover:text-brand-600">← Back to sign in</button>
        </p>
      </form>
    );
  }

  if (step === 'reset') {
    return (
      <form onSubmit={handleReset} className="space-y-4">
        <div className="text-center mb-2">
          <p className="text-sm font-semibold text-slate-800">Enter your reset code</p>
        </div>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {info && <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700 font-medium">{info}</div>}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Reset Code</label>
          <input
            type="text" autoFocus placeholder="6-digit code" maxLength={6}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 tracking-widest text-center text-lg"
            value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))} required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">New Password</label>
          <input
            type="password" placeholder="Min. 6 characters"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirm New Password</label>
          <input
            type="password" placeholder="Repeat password"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        </div>
        <button type="submit" disabled={loading}
          className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-500 disabled:opacity-60">
          {loading ? 'Resetting…' : 'Set new password'}
        </button>
        <p className="text-center text-sm">
          <button type="button" onClick={() => setStep('forgot')} className="text-slate-500 hover:text-brand-600">← Change phone number</button>
        </p>
      </form>
    );
  }

  // ── Login step ─────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleLogin} className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {info && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</div>}

      <div>
        <label htmlFor="login-phone" className="mb-1.5 block text-sm font-medium text-slate-700">Phone Number</label>
        <input
          id="login-phone" type="tel"
          autoComplete="tel"
          value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder="0700000000"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="login-password" className="text-sm font-medium text-slate-700">Password</label>
          <button type="button" onClick={() => { setStep('forgot'); setForgotPhone(phone); setError(''); setInfo(''); }}
            className="text-xs text-brand-600 hover:text-brand-500 font-medium">
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
          />
          <button type="button" onClick={() => setShowPassword(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 hover:text-slate-600">
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <button type="submit" disabled={loading}
        className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-500 disabled:opacity-60">
        {loading ? 'Signing in…' : 'Sign In'}
      </button>

    </form>
  );
}
