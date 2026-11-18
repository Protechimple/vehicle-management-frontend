import { Card } from '../../components/ui';
import { PageHeader } from './tenantDisplay';

// Placeholder: per-organization module switches (e.g. Inventory on for one organization, off for another) come later.
export default function FeatureFlagsPage() {
  return (
    <div>
      <PageHeader
        title="Feature flags"
        description="Turn modules on or off for each organization."
      />

      <Card>
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <svg viewBox="0 0 20 20" aria-hidden="true" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 17.5V3M4.5 3.5h9l-1.8 3.5 1.8 3.5h-9" />
            </svg>
          </span>
          <h2 className="text-base font-semibold text-steel-900">Coming soon</h2>
          <p className="mt-1 max-w-md text-sm text-steel-500">
            Here you will be able to choose which modules each organization can use — for example, switch Inventory on
            for one organization and off for another.
          </p>
        </div>
      </Card>
    </div>
  );
}
