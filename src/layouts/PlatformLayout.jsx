import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { usePlatformAuth } from '../context/PlatformAuthContext';
import { Initials } from '../pages/platform/tenantDisplay';

const ICONS = {
  overview: 'M3 10.5 10 4l7 6.5M5 9v7h4v-4h2v4h4V9',
  organizations: 'M3 17V6l5-2v13M8 17V8l9 3v6M3 17h14M11 12.5h1.5M11 15h1.5M5 8h1M5 11h1M5 14h1',
  activity: 'M2.5 10h3l2-5 3.5 10 2-5h4.5',
  flags: 'M4.5 17.5V3M4.5 3.5h9l-1.8 3.5 1.8 3.5h-9',
  account: 'M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 17c.7-3 3.1-4.5 6-4.5s5.3 1.5 6 4.5',
};

// Overview (/platform/overview) and Activity (/platform/activity) are hidden from the menu for now.
const NAV_ITEMS = [
  { to: '/platform/tenants', label: 'Organizations', icon: 'organizations' },
  { to: '/platform/feature-flags', label: 'Feature flags', icon: 'flags' },
  { to: '/platform/account', label: 'My account', icon: 'account' },
];

function NavIcon({ name }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  );
}

function Sidebar({ open, onNavigate }) {
  const { user, logOut } = usePlatformAuth();

  return (
    <aside
      className={[
        'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-brand-900',
        'transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}
    >
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10 px-5">
        <span className="text-lg font-bold tracking-[0.06em] text-white">VMMS</span>
        <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wider text-amber-300 uppercase ring-1 ring-amber-300/30">
          Super Admin
        </span>
      </div>

      <nav aria-label="Super Admin" className="flex flex-1 flex-col gap-0.5 px-2.5 py-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                'flex items-center gap-2.5 rounded px-3 py-2 text-sm font-semibold transition-colors',
                isActive ? 'bg-accent text-white' : 'text-nav-200 hover:bg-white/10 hover:text-white',
              ].join(' ')
            }
          >
            <NavIcon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 px-1">
          <Initials name={user?.name} tone="platform" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
            <p className="truncate text-xs text-nav-300">{user?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={logOut}
          className="mt-3 w-full rounded border border-white/15 px-3 py-1.5 text-sm font-semibold text-nav-200 transition-colors hover:bg-white/10 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

export default function PlatformLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />

      {sidebarOpen && (
        <div
          role="presentation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-brand-900/50 lg:hidden"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-steel-200 bg-surface px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              aria-label="Toggle navigation"
              className="rounded border border-steel-200 px-2.5 py-1.5 text-steel-600 hover:bg-steel-50 lg:hidden"
            >
              <span aria-hidden="true">☰</span>
            </button>
            <p className="truncate text-sm font-semibold text-steel-500">Platform console</p>
          </div>
          <ThemeToggle />
        </header>

        <main className="w-full flex-1 p-3 sm:p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
