import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

// Pages that render their own <BackLink> register here, so the layout's automatic back arrow
// (<AutoBackLink>) hides itself and a page never shows two.
const BackLinkContext = createContext(null);

export function BackLinkProvider({ children }) {
  const [count, setCount] = useState(0);
  const register = useCallback(() => {
    setCount((n) => n + 1);
    return () => setCount((n) => n - 1);
  }, []);
  const value = useMemo(() => ({ count, register }), [count, register]);
  return <BackLinkContext.Provider value={value}>{children}</BackLinkContext.Provider>;
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 10H4M9 5l-5 5 5 5" />
    </svg>
  );
}

// min-h-10 keeps a comfortable tap target on phones.
const CLASSES =
  'group inline-flex min-h-10 max-w-full items-center gap-1.5 rounded px-2 text-sm font-semibold text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-700 sm:min-h-8';

// Pulls the button left so the arrow lines up with the heading, unless the caller sets its own margin.
function classes(className) {
  const offset = /(^|\s)-?m[lx]-/.test(className) ? '' : '-ml-2';
  return `${CLASSES} ${offset} ${className}`.trim();
}

function Content({ label }) {
  return (
    <>
      <ArrowIcon />
      <span className="truncate">{label}</span>
    </>
  );
}

/**
 * Back navigation for a page. With `to` it links to that page; without it, it goes back in history
 * (or to `fallback` when the page was opened directly).
 */
export default function BackLink({ to, state, label = 'Back', fallback = '/dashboard', className = '' }) {
  const registry = useContext(BackLinkContext);
  const register = registry?.register;
  useLayoutEffect(() => register?.(), [register]);

  if (to) {
    return (
      <Link to={to} state={state} className={classes(className)}>
        <Content label={label} />
      </Link>
    );
  }
  return <HistoryBack label={label} fallback={fallback} className={className} />;
}

function HistoryBack({ label, fallback, className }) {
  const navigate = useNavigate();
  const location = useLocation();
  // 'default' means this is the first entry of the session (direct load / refresh), so there is nothing to go back to.
  const hasHistory = location.key !== 'default';
  return (
    <button
      type="button"
      onClick={() => (hasHistory ? navigate(-1) : navigate(fallback))}
      className={classes(className)}
    >
      <Content label={label} />
    </button>
  );
}

// Parent pages for routes whose natural parent ("/inventory/purchases", "/fuel", ...) has no page of its own.
const PARENT_OVERRIDES = {
  '/inventory/purchases': '/inventory/movements',
  '/inventory/asset-issues': '/inventory/movements',
  '/inventory/stock-adjustments': '/inventory/movements',
  '/inventory/stock-transfers': '/inventory/movements',
  '/fuel/issues/:id': '/fuel/issues',
  '/fuel/external/:id': '/fuel/external',
  '/adblue/purchases/:id': '/adblue/purchases',
  '/adblue/fillings/:id': '/adblue/fillings',
  // /centring/:type/new — the entry forms belong to the movements list.
  '/centring/:type': '/centring/movements',
};

// Section roots that only redirect to one of their own tabs, so they are not a real "parent" page.
const SECTION_ROOTS = ['/fuel', '/inventory', '/platform', '/maintenance', '/adblue', '/tyres', '/centring'];
const looksLikeId = (segment) => /^\d+$|^[0-9a-f-]{16,}$/i.test(segment);

function parentOf(pathname, home) {
  const segments = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const last = segments.pop();
  if (segments.length === 0) return home;
  const parent = `/${segments.join('/')}`;
  const pattern =
    segments.length > 2 ? `/${segments.slice(0, 2).join('/')}/:id` : segments.length === 2 ? `/${segments[0]}/:type` : parent;
  const override = PARENT_OVERRIDES[parent] ?? PARENT_OVERRIDES[pattern];
  if (override) return override;
  // A section tab (/maintenance/history) goes home; a record under a section (/tyres/42) goes to the section.
  if (SECTION_ROOTS.includes(parent) && !(looksLikeId(last) && parent !== '/platform')) return home;
  return parent;
}

/**
 * Rendered by the layouts above every page. Shows a back arrow unless the page is a home page
 * (`hideOn`) or already renders its own <BackLink>.
 */
export function AutoBackLink({ home = '/dashboard', hideOn = [] }) {
  const registry = useContext(BackLinkContext);
  const { pathname } = useLocation();
  if ((registry?.count ?? 0) > 0) return null;
  if (hideOn.includes(pathname.replace(/\/+$/, '') || '/')) return null;
  return (
    <div className="mb-2">
      <HistoryBack label="Back" fallback={parentOf(pathname, home)} />
    </div>
  );
}
