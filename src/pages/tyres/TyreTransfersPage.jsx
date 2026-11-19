import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { tyresApi } from '../../api/client';
import { Alert, Button, Pagination, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import { formatStamp, formatWhen } from '../../config/tyres';

function TyreCodes({ tyres }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tyres.map((t) => (
        <Link key={t.id} to={`/tyres/${t.id}`} className="rounded border border-steel-200 px-1.5 text-xs font-semibold text-brand-600 tabular-nums hover:bg-brand-50">
          {t.tyreCode}
        </Link>
      ))}
    </div>
  );
}

export default function TyreTransfersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [notice] = useState(location.state?.message ?? null);

  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const load = useCallback(async (p) => {
    setError(null);
    try {
      setResult(await tyresApi.transfers({ page: p }));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  const columns = [
    { key: 'number', label: 'Transfer', render: (t) => <span className="font-semibold text-steel-900">{t.transferNumber}</span> },
    {
      key: 'when',
      label: 'Date & time',
      render: (t) => (
        <div className="flex flex-col">
          <span className="whitespace-nowrap">{formatWhen(t.transferDate, t.transferTime)}</span>
          <span className="text-xs whitespace-nowrap text-steel-500">Recorded {formatStamp(t.createdAt)}</span>
        </div>
      ),
    },
    {
      key: 'route',
      label: 'From → To',
      render: (t) => (
        <span>
          {t.fromSiteName} <span className="text-steel-400">→</span> <span className="font-semibold">{t.toSiteName}</span>
        </span>
      ),
    },
    {
      key: 'tyres',
      label: 'Tyres',
      render: (t) => (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-steel-500">{t.tyreCount} {t.tyreCount === 1 ? 'tyre' : 'tyres'}</span>
          <TyreCodes tyres={t.tyres} />
        </div>
      ),
    },
    {
      key: 'by',
      label: 'By',
      render: (t) => (
        <div className="flex flex-col text-xs text-steel-500">
          <span>{t.createdByName ?? '—'}</span>
          {t.notes && <span className="text-steel-600">{t.notes}</span>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Tyre Transfers</h1>
          <p className="mt-1 text-steel-500">Tyres are used only at their own site. Move tyres from one site's stores to another here.</p>
        </div>
        <Can resource="TYRE" action="TRANSFER">
          <Button as={Link} to="/tyres/transfers/new">
            + New transfer
          </Button>
        </Can>
      </div>

      <Alert tone="success">{notice}</Alert>
      <Alert tone="error">{error}</Alert>

      <div className="rounded border border-steel-200 bg-surface">
        {!result ? (
          <Spinner label="Loading transfers" />
        ) : (
          <>
            <Table columns={columns} rows={result.data} getRowKey={(t) => t.id} emptyMessage="No tyres have been transferred yet." />
            <Pagination page={result.pagination.page} pages={result.pagination.pages} total={result.pagination.total} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
