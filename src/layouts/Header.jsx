import { RoleBadge, Button } from '../components/ui';
import BrandingButton from '../components/BrandingButton';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

// On phones (below `sm`) the theme toggle and branding button live in the
// sidebar drawer instead, so the organization name and title get the room.
export default function Header({ onToggleSidebar }) {
  const { user, organization, logOut } = useAuth();
  const { branding, logoUrl } = useBranding();

  const organizationName = organization?.organizationName;
  const title = branding?.dashboardTitle;

  return (
    <header className="sticky top-0 z-30 flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-steel-200 bg-surface px-4 py-2 sm:h-16 sm:gap-4 sm:px-6 sm:py-0 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)]">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3.5">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
          className="shrink-0 rounded border border-steel-200 px-2.5 py-1.5 text-steel-600 hover:bg-steel-50 lg:hidden"
        >
          <span aria-hidden="true">☰</span>
        </button>

        {logoUrl && (
          <img
            src={logoUrl}
            alt={`${organizationName ?? 'Organization'} logo`}
            className="h-8 max-w-16 shrink-0 object-contain sm:h-10 sm:max-w-36 dark:rounded dark:bg-white dark:p-0.5"
          />
        )}

        <div className="min-w-0 leading-tight">
          <p
            title={organizationName}
            className="line-clamp-2 text-base font-bold tracking-tight wrap-break-word text-steel-900 sm:block sm:truncate sm:text-xl"
          >
            {organizationName}
          </p>
          {title && (
            <p
              title={title}
              className="mt-0.5 line-clamp-2 text-xs font-semibold wrap-break-word text-orange-600 sm:mt-0 sm:block sm:truncate md:hidden dark:text-orange-400"
            >
              {title}
            </p>
          )}
        </div>
      </div>

      <div className="hidden min-w-0 justify-center md:flex">
        {title && (
          <p
            title={title}
            className="max-w-[min(32rem,36vw)] truncate text-sm font-semibold text-orange-600 dark:text-orange-400"
          >
            {title}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3 md:justify-self-end">
        <ThemeToggle className="hidden sm:inline-flex" />
        <BrandingButton className="hidden sm:inline-flex" />

        <div className="hidden text-right leading-tight sm:block">
          <p className="text-sm font-semibold text-steel-900">{user?.name}</p>
          <p className="text-xs text-steel-500">{user?.email}</p>
        </div>

        <RoleBadge role={user?.role} />

        <Button variant="secondary" size="sm" onClick={logOut}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
