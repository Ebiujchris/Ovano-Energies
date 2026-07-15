import { Link } from 'react-router-dom';

interface NavbarProps {
  onSignIn: () => void;
}

export default function Navbar({ onSignIn }: NavbarProps) {
  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-slate-850/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-xs font-bold text-white shadow-lg shadow-brand-500/30">
            OE
          </div>
          <span className="font-display text-xl font-semibold tracking-tight text-white">
            Ovano Energies
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm font-medium text-slate-300 transition hover:text-white">
            Features
          </a>
          <a href="#how-it-works" className="text-sm font-medium text-slate-300 transition hover:text-white">
            How it works
          </a>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSignIn}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-200 transition hover:text-white"
          >
            Sign In
          </button>
        </div>
      </nav>
    </header>
  );
}
