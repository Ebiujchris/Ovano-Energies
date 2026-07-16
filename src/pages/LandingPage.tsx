import { useNavigate } from 'react-router-dom';
import LoginForm from '../components/LoginForm';

export default function LandingPage() {
  const navigate = useNavigate();
  const handleSuccess = () => navigate('/dashboard');

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-600 px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white overflow-hidden shadow-lg shadow-black/20">
            <img src="/images/Ovano logo.jpeg" alt="Ovano Energies" className="h-full w-full object-contain" />
          </div>
          <div>
            <p className="text-base font-semibold text-white leading-tight">Ovano Energies</p>
            <p className="text-xs text-blue-200">Business Management</p>
          </div>
        </div>

        {/* Card — login only */}
        <div className="rounded-3xl bg-white p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-slate-900 mb-6 text-center">Sign in to your account</h2>
          <LoginForm onSuccess={handleSuccess} onSwitchToRegister={() => {}} />
        </div>

        <p className="mt-6 text-center text-xs text-blue-200">© {new Date().getFullYear()} Ovano Energies</p>
      </div>
    </div>
  );
}
