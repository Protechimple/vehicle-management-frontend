import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandingButton from '../components/BrandingButton';
import ThemeToggle from '../components/ThemeToggle';

const linkClasses = ({ isActive }) =>
  [
    // Taller rows in the phone/tablet drawer so links are easy to tap; the desktop sidebar keeps its size.
    'block rounded px-3 py-2.5 text-sm transition-colors lg:py-1.5',
    isActive
      ? 'bg-accent font-semibold text-white'
      : 'text-nav-300 hover:bg-white/10 hover:text-white',
  ].join(' ');

function NavSection({ title, paths, children }) {
  const { pathname } = useLocation();
  const isInSection = paths.some((path) => pathname.startsWith(path));
  const [open, setOpen] = useState(isInSection);

  useEffect(() => {
    if (isInSection) setOpen(true);
  }, [isInSection]);

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={[
          'flex w-full items-center justify-between rounded px-3 py-2.5 text-sm font-semibold transition-colors lg:py-2',
          isInSection ? 'text-white' : 'text-nav-200 hover:bg-white/10 hover:text-white',
        ].join(' ')}
      >
        {title}
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={`h-3 w-3 shrink-0 text-steel-400 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        >
          <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="mt-0.5 mb-1 ml-4 flex flex-col gap-0.5 border-l border-white/10 pl-2">{children}</div>}
    </div>
  );
}

const VIEW = (resource) => [[resource, 'READ']];

// Every link names what the user must be allowed to do to see it. The Admin decides that per role and per person, so a
// section with nothing left in it disappears.
const NAV_SECTIONS = [
  {
    title: 'Asset Management',
    paths: ['/vehicles', '/machinery', '/sites', '/site-management'],
    links: [
      { to: '/vehicles', label: 'Vehicles', anyOf: VIEW('VEHICLE') },
      { to: '/machinery', label: 'Machinery', anyOf: VIEW('MACHINERY') },
      { to: '/sites', label: 'Sites', roles: ['admin'] },
      { to: '/site-management', label: 'Site Management', anyOf: [['VEHICLE', 'READ'], ['MACHINERY', 'READ']] },
    ],
  },
  {
    title: 'Maintenance',
    paths: ['/maintenance'],
    links: [
      { to: '/maintenance/preventive', label: 'Preventive Maintenance', anyOf: VIEW('MAINTENANCE') },
      { to: '/maintenance/breakdowns', label: 'Breakdown Maintenance', anyOf: VIEW('MAINTENANCE') },
      { to: '/maintenance/history', label: 'Maintenance History', anyOf: VIEW('MAINTENANCE') },
    ],
  },
  {
    title: 'Compliance',
    paths: ['/compliance'],
    links: [{ to: '/compliance', label: 'Compliance Documents', anyOf: VIEW('COMPLIANCE') }],
  },
  {
    title: 'Fuel',
    paths: ['/fuel'],
    links: [
      { to: '/fuel/stock', label: 'Fuel Stock', anyOf: VIEW('FUEL_STOCK') },
      { to: '/fuel/collections', label: 'Fuel Collections', anyOf: VIEW('FUEL_COLLECTION') },
      { to: '/fuel/issues', label: 'Fuel Issues', anyOf: VIEW('FUEL') },
      { to: '/fuel/external', label: 'External Vehicle Fuel', anyOf: VIEW('FUEL') },
      { to: '/fuel/reports', label: 'Fuel Reports', allOf: [['FUEL', 'READ'], ['REPORTS', 'VIEW']] },
      { to: '/fuel/stations', label: 'Fuel Stations', anyOf: [['FUEL_STATION', 'CREATE'], ['FUEL_STATION', 'UPDATE']] },
    ],
  },
  {
    title: 'AdBlue',
    paths: ['/adblue'],
    links: [
      { to: '/adblue/overview', label: 'Overview', anyOf: VIEW('ADBLUE') },
      { to: '/adblue/purchases', label: 'Purchases', anyOf: VIEW('ADBLUE') },
      { to: '/adblue/fillings', label: 'Filling Records', anyOf: VIEW('ADBLUE') },
      { to: '/adblue/reports', label: 'Reports', anyOf: VIEW('ADBLUE') },
    ],
  },
  {
    title: 'Tyres',
    paths: ['/tyres'],
    links: [
      { to: '/tyres/stores', label: 'Tyre Stores', anyOf: VIEW('TYRE') },
      { to: '/tyres/purchases', label: 'Tyre Purchases', anyOf: VIEW('TYRE') },
      { to: '/tyres/assets', label: 'Vehicle Tyres', anyOf: VIEW('TYRE') },
      { to: '/tyres/transfers', label: 'Tyre Transfers', anyOf: VIEW('TYRE') },
      { to: '/tyres/history', label: 'Tyre History', anyOf: VIEW('TYRE') },
      { to: '/tyres/reports', label: 'Tyre Reports', allOf: [['TYRE', 'READ'], ['REPORTS', 'VIEW']] },
    ],
  },
  {
    title: 'Batteries',
    paths: ['/batteries'],
    links: [
      { to: '/batteries', end: true, label: 'All Batteries', anyOf: VIEW('BATTERY') },
      { to: '/batteries/add', label: 'Add Batteries', anyOf: [['BATTERY', 'CREATE']] },
      { to: '/batteries/history', label: 'Battery History', anyOf: VIEW('BATTERY') },
    ],
  },
  {
    title: 'Inventory',
    paths: ['/inventory'],
    links: [
      {
        to: '/inventory/catalog',
        label: 'Item Catalog',
        anyOf: [['ITEM', 'READ'], ['ITEM_CATEGORY', 'READ'], ['UOM', 'READ'], ['SUPPLIER', 'READ']],
      },
      {
        to: '/inventory/movements',
        label: 'Stock Movements',
        anyOf: [['PURCHASE', 'READ'], ['ASSET_ISSUE', 'READ'], ['STOCK_ADJUSTMENT', 'READ'], ['STOCK_TRANSFER', 'READ']],
      },
      { to: '/inventory/stock', label: 'Stock', anyOf: VIEW('STOCK') },
      { to: '/inventory/reports', label: 'Inventory Reports', allOf: [['STOCK', 'READ'], ['REPORTS', 'VIEW']] },
    ],
  },
  {
    title: 'Team',
    paths: ['/team'],
    links: [{ to: '/team', label: 'My Team', anyOf: [['USERS', 'VIEW_TEAM']] }],
  },
  {
    title: 'Administration',
    paths: ['/users', '/access', '/profile'],
    links: [
      { to: '/profile', label: 'My Profile', roles: ['admin'] },
      { to: '/users', label: 'Organization Users', roles: ['admin'] },
      { to: '/access', label: 'Roles & Access', roles: ['admin'] },
    ],
  },
];

export default function Sidebar({ open, onNavigate }) {
  const { role, can } = useAuth();
  const allowed = (link) =>
    (!link.roles || link.roles.includes(role)) &&
    (!link.anyOf || link.anyOf.some(([resource, action]) => can(resource, action))) &&
    (!link.allOf || link.allOf.every(([resource, action]) => can(resource, action)));
  const visibleSections = NAV_SECTIONS.map((section) => ({ ...section, links: section.links.filter(allowed) })).filter(
    (section) => section.links.length > 0
  );

  return (
    <aside
      className={[
        'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col overflow-y-auto bg-brand-900',
        'scrollbar-gutter-stable scrollbar-thin [scrollbar-color:var(--color-nav-600)_transparent]',
        'transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}
    >
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-white/10 px-5">
        <span className="text-lg font-bold tracking-[0.06em] text-white">VMMS</span>
        {/* On phones these move here from the header (see Header.jsx). */}
        <div className="flex items-center gap-1 sm:hidden">
          <ThemeToggle tone="nav" />
          <BrandingButton tone="nav" />
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 px-2.5 py-3">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            [
              'block rounded px-3 py-2.5 text-sm font-semibold transition-colors lg:py-2',
              isActive ? 'bg-accent text-white' : 'text-nav-200 hover:bg-white/10 hover:text-white',
            ].join(' ')
          }
          onClick={onNavigate}
        >
          Dashboard
        </NavLink>

        {visibleSections.map((section) => (
          <NavSection key={section.title} title={section.title} paths={section.paths}>
            {section.links.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={linkClasses} onClick={onNavigate}>
                {link.label}
              </NavLink>
            ))}
          </NavSection>
        ))}
      </nav>
    </aside>
  );
}
