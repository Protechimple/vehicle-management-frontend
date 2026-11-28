import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usersApi } from '../../api/client';
import { MEMBER_ROLES, roleLabel } from '../../config/permissions';
import { Alert, Spinner } from '../ui';
import DashboardCard from './DashboardCard';

// How many people report to this Site Manager, by role.
export default function TeamCard({ refreshKey }) {
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
