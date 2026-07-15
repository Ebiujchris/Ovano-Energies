import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import AuthModal, { type AuthMode } from '../components/AuthModal';

const features = [
  {
    icon: '🔋',
    title: 'Stock Tracking',
    description: 'Track high-value energy equipment, from batteries to solar panels. Never run out of essential stock.',
  },
  {
    icon: '⚡️',
    title: 'Sales Insights',
    description: 'Record large installations and daily retail sales. Calculate profit margins instantly.',
  },
  {
    icon: '📝',
    title: 'Installment & Credit Management',
    description: 'Manage customer credit for expensive energy setups and track installment payments easily.',
  },
  {
    icon: '📈',
    title: 'Business Analytics',
    description: 'Get a bird\'s-eye view of your fastest-moving energy products and overall business growth.',
  },
];

const steps = [
  { step: '01', title: 'Create your account', text: 'Register with your phone number and business name in under a minute.' },
  { step: '02', title: 'Add your products', text: 'Set up inventory with solar gear, accessories, prices, and stock.' },
  { step: '03', title: 'Start selling', text: 'Record installations, track profit, and manage payments from anywhere.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');

  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const handleAuthSuccess = () => {
    setAuthOpen(false);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar
        onSignIn={() => openAuth('login')}
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-850 pt-28 pb-20 lg:pt-36 lg:pb-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 right-0 h-[600px] w-[600px] rounded-full bg-brand-500/30 blur-3xl" />
          <div className="absolute top-40 -left-20 h-[400px] w-[400px] rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/4 h-[500px] w-[500px] rounded-full bg-brand-400/20 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-sm text-brand-300">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                Powering Ugandan businesses
              </div>

              <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                Manage your{' '}
                <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
                  energy business
                </span>{' '}
                smarter
              </h1>

              <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-400">
                Ovano Energies is the all-in-one management platform for energy retail businesses.
                Track inventory, record sales, manage credits, and grow your business — on web and mobile.
              </p>


            </div>

            {/* Dashboard preview card */}
            <div className="relative hidden lg:block">
              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 shadow-2xl backdrop-blur">
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-brand-500/20 p-4">
                      <div className="text-xs text-brand-300">Today&apos;s Sales</div>
                      <div className="mt-1 font-display text-2xl font-bold text-white">UGX 850K</div>
                    </div>
                    <div className="rounded-xl bg-slate-700/50 p-4">
                      <div className="text-xs text-slate-400">Today&apos;s Profit</div>
                      <div className="mt-1 font-display text-2xl font-bold text-white">UGX 210K</div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-700/30 p-4">
                    <div className="mb-3 text-xs font-medium text-slate-400">Recent Sales</div>
                    {['200W Solar Panel × 2', 'Tubular Battery 200Ah', 'Solar Inverter 3kVA'].map((item) => (
                      <div
                        key={item}
                        className="flex items-center justify-between border-b border-slate-600/50 py-2 last:border-0"
                      >
                        <span className="text-sm text-slate-300">{item}</span>
                        <span className="text-sm font-medium text-brand-400">+UGX</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Powering your energy business
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              From inventory to insights — manage your energy retail operations in one place.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:border-brand-200 hover:shadow-lg hover:shadow-brand-500/5"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl transition group-hover:scale-110">
                  {feature.icon}
                </div>
                <h3 className="font-display text-lg font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Up and running in minutes
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              No complicated setup. Just register and start managing your energy business.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {steps.map((item) => (
              <div key={item.step} className="relative rounded-2xl bg-white p-8 shadow-sm">
                <div className="font-display text-4xl font-bold text-brand-100">{item.step}</div>
                <h3 className="mt-4 font-display text-xl font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
              OE
            </div>
            <span className="font-display font-semibold text-slate-900">Ovano Energies</span>
          </div>
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} Ovano Energies. Energy management for Uganda.
          </p>
        </div>
      </footer>

      <AuthModal
        isOpen={authOpen}
        mode={authMode}
        onClose={() => setAuthOpen(false)}
        onModeChange={setAuthMode}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
