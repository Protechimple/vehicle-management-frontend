import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi, usersApi } from '../../api/client';
import { MEMBER_ROLES, roleLabel } from '../../config/permissions';
import { useAuth } from '../../context/AuthContext';
import { Alert, Spinner } from '../ui';
import DashboardCard from './DashboardCard';
import { monthName } from './RunningCost';

const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const numberFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function useSiteBreakdown({ enabled, refreshKey }) {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    dashboardApi
      .sites()
      .then((response) => !cancelled && setState({ data: response.data, error: null }))
      .catch((err) => !cancelled && setState({ data: null, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [enabled, refreshKey]);
  return state;
}

// Every site the user covers side by side, so a Site Manager can see where attention is needed. Columns follow what the
// user may see: no fuel column without fuel access, and so on.
export function SiteBreakdownCard({ data, onSelectSite }) {
  const { can } = useAuth();
  const columns = [
    { key: 'vehicles', label: 'Vehicles', show: can('VEHICLE', 'READ'), value: (s) => numberFormat.format(s.vehicles) },
    { key: 'machinery', label: 'Machinery', show: can('MACHINERY', 'READ'), value: (s) => numberFormat.format(s.machinery) },
    {
      key: 'openMaintenance',
      label: 'Open jobs',
      show: can('MAINTENANCE', 'READ'),
      value: (s) => (
        <span className={s.openBreakdowns > 0 ? 'font-semibold text-danger-600' : undefined}>
          {numberFormat.format(s.openMaintenance)}
          {s.openBreakdowns > 0 ? ` (${s.openBreakdowns} breakdown${s.openBreakdowns === 1 ? '' : 's'})` : ''}
        </span>
      ),
    },
    { key: 'fuelCost', label: 'Fuel', show: can('FUEL', 'READ'), value: (s) => rupees.format(s.fuelCost) },
    { key: 'partsCost', label: 'Parts', show: can('STOCK', 'READ'), value: (s) => rupees.format(s.partsCost) },
    { key: 'staff', label: 'Staff', show: true, value: (s) => numberFormat.format(s.staff) },
  ].filter((column) => column.show);

  return (
    <DashboardCard title="Your sites" aside={`Costs for ${monthName(data.month, 'long')}`} flush>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-steel-200 text-xs font-semibold tracking-wide text-steel-500 uppercase">
              <th scope="col" className="px-4 py-2">Site</th>
              {columns.map((c) => (
                <th key={c.key} scope="col" className="px-4 py-2 text-right whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-steel-100">
            {data.sites.map((site) => (
              <tr key={site.siteId} className="hover:bg-steel-50">
                <td className="px-4 py-2">
                  <button
                    type="button"
                    className="text-left font-medium text-brand-700 hover:underline"
                    onClick={() => onSelectSite(String(site.siteId))}
                    title="Show this site only"
                  >
                    {site.name}
                  </button>
                  {site.location && <div className="text-xs text-steel-500">{site.location}</div>}
                </td>
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-2 text-right whitespace-nowrap text-steel-700 tabular-nums">
                    {c.value(site)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}

// How many people report to this Site Manager, by role.
export function TeamCard({ refreshKey }) {
  const [team, setTeam] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    usersApi
      .team()
      .then((response) => !cancelled && setTeam(response.data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <DashboardCard title="My team" aside={<Link to="/team" className="text-brand-700 hover:underline">View all</Link>}>
      <Alert tone="error">{error}</Alert>
      {!team && !error && <Spinner label="Loading team" />}
      {team && (
        <dl className="grid grid-cols-3 gap-3 pb-1">
          {MEMBER_ROLES.map((role) => {
            const people = team.filter((m) => m.role === role && m.status === 'active');
            return (
              <div key={role}>
                <dt className="text-xs text-steel-500">{roleLabel(role)}s</dt>
                <dd className="text-xl font-semibold text-steel-900 tabular-nums">{people.length}</dd>
              </div>
            );
          })}
        </dl>
      )}
    </DashboardCard>
  );
}
