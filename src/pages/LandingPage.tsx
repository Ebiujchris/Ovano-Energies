import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';

type Mode = 'login' | 'register';

export default function LandingPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');

  const handleSuccess = () => navigate('/dashboard');

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-600 px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-sm font-bold text-blue-600 shadow-lg shadow-black/20">
            OE
          </div>
          <div>
            <p className="text-base font-semibold text-white leading-tight">Ovano Energies</p>
            <p className="text-xs text-blue-200">Business Management</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-3xl bg-white p-8 shadow-2xl">
          {/* Tab switcher */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Register
            </button>
          </div>

          {mode === 'login'
            ? <LoginForm onSuccess={handleSuccess} onSwitchToRegister={() => setMode('register')} />
            : <RegisterForm onSuccess={handleSuccess} onSwitchToLogin={() => setMode('login')} />
          }
        </div>

        <p className="mt-6 text-center text-xs text-blue-200">© {new Date().getFullYear()} Ovano Energies</p>
      </div>
    </div>
  );
}
