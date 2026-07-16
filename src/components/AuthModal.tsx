import { useEffect } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

export type AuthMode = 'login' | 'register';

interface AuthModalProps {
  isOpen: boolean;
  mode: AuthMode;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
  onSuccess: () => void;
}

export default function AuthModal({
  isOpen,
  mode,
  onClose,
  onModeChange,
  onSuccess,
}: AuthModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          ✕
        </button>

        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-xl overflow-hidden">
            <img src="/images/Ovano logo.jpeg" alt="Ovano Energies" className="h-full w-full object-contain" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-slate-900">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'login'
              ? 'Sign in to manage your shop'
              : 'Register your shop with Ovano Energies'}
          </p>
        </div>

        <div className="mb-6 flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => onModeChange('login')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === 'login'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => onModeChange('register')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === 'register'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Register
          </button>
        </div>

        {mode === 'login' ? (
          <LoginForm
            onSuccess={onSuccess}
            onSwitchToRegister={() => onModeChange('register')}
          />
        ) : (
          <RegisterForm
            onSuccess={onSuccess}
            onSwitchToLogin={() => onModeChange('login')}
          />
        )}
      </div>
    </div>
  );
}
