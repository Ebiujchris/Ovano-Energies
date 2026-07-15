import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { can, isOwner } from '../lib/permissions';

interface PageShellProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  path: string;
  permission?: string; // undefined = all authenticated users
}

const ALL_NAV_ITEMS: NavItem[] = [
  { label: 'Overview',    path: '/dashboard' },
  { label: 'Sales',       path: '/sales' },
  { label: 'Receipts',    path: '/receipts' },
  { label: 'Credits',     path: '/credits',       permission: 'canApproveCredits' },
  { label: 'Inventory',   path: '/products',      permission: 'canAccessInventory' },
  { label: 'Restock',     path: '/restock',       permission: 'canAccessInventory' },
  { label: 'Expenses',    path: '/expenses' },
  { label: 'Reports',     path: '/reports',       permission: 'canViewReports' },
  { label: 'Financials',  path: '/balance-sheet', permission: 'canViewReports' },
  { label: 'Cash Flow',   path: '/cash-flow',     permission: 'canViewReports' },
  { label: 'Comparison',  path: '/income-comparison', permission: 'canViewReports' },
  { label: 'Suppliers',   path: '/suppliers',     permission: 'canAccessInventory' },
  { label: 'Staff',       path: '/staff',         permission: 'ownerOnly' },
  { label: 'Settings',    path: '/settings' },
];

export default function PageShell({ title, description, children }: PageShellProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); };
  const closeMenu = () => setMenuOpen(false);

  const visibleNav = ALL_NAV_ITEMS.filter(({ permission }) => {
    if (!permission) return true;
    if (permission === 'ownerOnly') return isOwner(user);
    return can(user, permission);
  });

  const roleLabel = user?.accountType === 'staff'
    ? (user.role ?? 'Staff').replace('_', ' ')
    : 'Owner';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_32%),linear-gradient(135deg,_#f8fafc_0%,_#eef4ff_100%)]">

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-[10px] font-bold text-white shadow shadow-brand-500/30">
              OE
            </div>
            <div className="hidden sm:block">
              <p className="text-base font-semibold text-slate-900 leading-tight">Ovano Energies</p>
              <p className="text-[10px] text-slate-500 leading-tight">Management workspace</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {/* User badge */}
            <div className="hidden sm:flex flex-col items-end mr-1">
              <span className="text-xs font-medium text-slate-700">{user?.name}</span>
              <span className="text-[10px] text-slate-400 capitalize">{roleLabel}</span>
            </div>
            <button type="button" onClick={handleLogout}
              className="hidden sm:inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
              Sign out
            </button>
            {/* Hamburger — mobile only */}
            <button type="button" onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600"
              aria-label="Toggle menu">
              {menuOpen
                ? <span className="text-lg leading-none">✕</span>
                : <span className="flex flex-col gap-1 items-center justify-center w-5">
                    <span className="block h-0.5 w-4 bg-slate-600 rounded" />
                    <span className="block h-0.5 w-4 bg-slate-600 rounded" />
                    <span className="block h-0.5 w-4 bg-slate-600 rounded" />
                  </span>
              }
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile slide-down nav ── */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-20 bg-slate-950/40" onClick={closeMenu}>
          <div className="absolute top-[57px] left-0 right-0 bg-white border-b border-slate-200 shadow-xl px-4 py-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-3 gap-2">
              {visibleNav.map((item) => (
                <NavLink key={item.path} to={item.path} onClick={closeMenu}
                  className={({ isActive }) =>
                    `rounded-xl px-3 py-2.5 text-center text-sm font-medium transition ${
                      isActive ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`
                  }>
                  {item.label}
                </NavLink>
              ))}
            </div>
            <button type="button" onClick={handleLogout}
              className="mt-3 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex min-h-[calc(100vh-57px)]">

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:w-52 lg:shrink-0 lg:flex-col border-r border-slate-200/80 bg-white/90 backdrop-blur p-4">
          <div className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 p-3 text-white shadow shadow-brand-500/20">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-100">Energy hub</p>
            <p className="mt-0.5 text-xs font-semibold">Manage your energy business.</p>
          </div>
          {/* User info */}
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold text-slate-800 truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-400 capitalize">{roleLabel}</p>
          </div>
          <nav className="mt-3 flex-1 space-y-0.5">
            {visibleNav.map((item) => (
              <NavLink key={item.path} to={item.path}
                className={({ isActive }) =>
                  `flex items-center rounded-xl px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 bg-white/90 backdrop-blur p-4 sm:p-6 lg:rounded-none">
          <div className="mb-5 border-b border-slate-200 pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-600">Ovano Energies</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{title}</h1>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
