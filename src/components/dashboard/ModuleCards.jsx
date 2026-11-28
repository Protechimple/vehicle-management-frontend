import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardCard from './DashboardCard';
import { monthName } from './RunningCost';

// Dashboard sections for Tyres, AdBlue and Centring. Each card has the same shape: two rows of tiles for where things
// stand now (four tiles, or three with the first one wide), then a short "this month" list of what happened.

const numberFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const litreFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const rate = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

const count = (value, word, plural = `${word}s`) => `${numberFormat.format(value)} ${value === 1 ? word : plural}`;
const litres = (value) => `${litreFormat.format(value)} L`;

// Loads one section for the chosen site (or all sites in scope) and reloads when the dashboard refreshes.
export function useDashboardSection(load, { enabled, siteId, refreshKey }) {
  const [state, setState] = useState({ siteId: null, data: null, error: null });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setState((current) => ({ siteId, data: current.siteId === siteId ? current.data : null, error: null }));
    load({ siteId: siteId || undefined })
      .then((response) => !cancelled && setState({ siteId, data: response.data, error: null }))
      .catch((err) => !cancelled && setState({ siteId, data: null, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [load, enabled, siteId, refreshKey]);

  return state;
}

const TILE_TONES = {
  default: 'text-steel-900',
  warning: 'text-warning-600',
  danger: 'text-danger-600',
};

function Tile({ label, value, detail, to, state, tone = 'default', wide = false }) {
  const body = (
    <>
      <span className="truncate text-xs text-steel-600">{label}</span>
      <span className={`truncate text-xl font-semibold tracking-tight tabular-nums ${TILE_TONES[tone]}`}>{value}</span>
      <span className="truncate text-xs text-steel-500">{detail}</span>
    </>
  );
  const classes = `flex min-w-0 flex-col rounded bg-steel-50 px-3 py-2 ${wide ? 'col-span-2' : ''}`;
  return to ? (
    <Link to={to} state={state} className={`${classes} transition-colors hover:bg-steel-100`}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

function Tiles({ children }) {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">{children}</div>;
}

// What happened this month: one row per kind of entry, with how many and (where known) what it cost. An empty-string
// amount keeps the row's count lined up with the rows that have one.
function MonthList({ month, rows }) {
  return (
    <div className="mt-3 flex flex-1 flex-col border-t border-steel-100 pt-2">
      <h3 className="text-[11px] font-semibold tracking-wider text-steel-500 uppercase">This month · {monthName(month, 'month')}</h3>
      <dl className="divide-y divide-steel-100">
        {rows.map(({ label, detail, amount, to, state }) => (
          <div key={label} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
            <dt className="min-w-0 truncate text-steel-700">
              {to ? (
                <Link to={to} state={state} className="hover:text-brand-700 hover:underline">
                  {label}
                </Link>
              ) : (
                label
              )}
            </dt>
            <dd className="flex shrink-0 items-baseline gap-3 tabular-nums">
              <span className="text-xs text-steel-500">{detail}</span>
              {amount !== undefined && <span className="min-w-20 text-right font-semibold text-steel-900">{amount}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ViewLink({ to, children }) {
  return (
    <Link to={to} className="font-semibold text-brand-600 hover:underline">
      {children}
    </Link>
  );
}

export function TyreCard({ data, className = '' }) {
  const { counts, newStoreValue, thisMonth } = data;
  const repairs = thisMonth.punctures + thisMonth.remoulds;
  return (
    <DashboardCard title="Tyres" className={className} aside={<ViewLink to="/tyres/stores">Tyre stores</ViewLink>}>
      <Tiles>
        <Tile label="Fitted" value={numberFormat.format(counts.fitted)} detail="On vehicles & machines" to="/tyres/assets" />
        <Tile label="New store" value={numberFormat.format(counts.new)} detail={`Worth ${rupees.format(newStoreValue)}`} to="/tyres/stores" state={{ status: 'new' }} />
        <Tile label="Spare store" value={numberFormat.format(counts.spare)} detail="Ready to refit" to="/tyres/stores" state={{ status: 'spare' }} />
        <Tile
          label="Scrapped cost"
          value={rupees.format(data.scrapped.cost)}
          detail={`${count(counts.scrapped, 'tyre')} in all`}
          to="/tyres/stores"
          state={{ status: 'scrapped' }}
        />
      </Tiles>
      <MonthList
        month={data.month}
        rows={[
          { label: 'Bought', detail: count(thisMonth.purchased.count, 'tyre'), amount: rupees.format(thisMonth.purchased.cost), to: '/tyres/purchases' },
          {
            label: 'Repairs',
            detail: repairs === 0 ? 'None' : `${count(thisMonth.punctures, 'puncture')} · ${count(thisMonth.remoulds, 'remould')}`,
            amount: rupees.format(thisMonth.repairCost),
            to: '/tyres/history',
          },
          {
            label: 'Scrapped',
            detail: thisMonth.scrapped.count === 0 ? count(0, 'tyre') : `${count(thisMonth.scrapped.count, 'tyre')} · scrap ${rupees.format(thisMonth.scrapped.scrapValue)}`,
            amount: rupees.format(thisMonth.scrapped.cost),
            to: '/tyres/stores',
            state: { status: 'scrapped' },
          },
        ]}
      />
    </DashboardCard>
  );
}

export function AdBlueCard({ data, className = '' }) {
  const { stock, thisMonth } = data;
  const averageRate = stock.quantity > 0 ? stock.value / stock.quantity : 0;
  return (
    <DashboardCard title="AdBlue" className={className} aside={<ViewLink to="/adblue/overview">Overview</ViewLink>}>
      <Tiles>
        <Tile wide label="In stock" value={litres(stock.quantity)} detail="Ready to fill" to="/adblue/overview" />
        <Tile label="Stock value" value={rupees.format(stock.value)} detail="At purchase price" to="/adblue/overview" />
        <Tile label="Average rate" value={stock.quantity > 0 ? rate.format(averageRate) : '—'} detail="Per litre" to="/adblue/overview" />
      </Tiles>
      <MonthList
        month={data.month}
        rows={[
          {
            label: 'Purchased',
            detail: `${count(thisMonth.purchased.entries, 'bill')} · ${litres(thisMonth.purchased.quantity)}`,
            amount: rupees.format(thisMonth.purchased.cost),
            to: '/adblue/purchases',
          },
          {
            label: 'Filled',
            detail: `${count(thisMonth.filled.entries, 'fill')} · ${litres(thisMonth.filled.quantity)}`,
            amount: rupees.format(thisMonth.filled.cost),
            to: '/adblue/fillings',
          },
        ]}
      />
    </DashboardCard>
  );
}

export function CentringCard({ data, className = '' }) {
  const { withCost, stock, thisMonth } = data;
  const value = (figure) => (withCost ? rupees.format(figure.value) : undefined);
  const movements = thisMonth.purchase.entries + thisMonth.issue.entries + thisMonth.transfer.entries + thisMonth.loss.entries;
  return (
    <DashboardCard
      title="Centring"
      className={className}
      aside={<ViewLink to={withCost ? '/centring/reports' : '/centring/movements'}>{withCost ? 'Reports' : 'Movements'}</ViewLink>}
    >
      <Tiles>
        {withCost ? (
          <>
            <Tile wide label="Stock value" value={rupees.format(stock.value)} detail="At average price" to="/centring/stock" />
            <Tile label="Items in stock" value={numberFormat.format(stock.items)} detail="Catalog items held" to="/centring/stock" />
          </>
        ) : (
          <>
            <Tile wide label="Items in stock" value={numberFormat.format(stock.items)} detail="Catalog items held" to="/centring/stock" />
            <Tile label="Movements" value={numberFormat.format(movements)} detail="Entries this month" to="/centring/movements" />
          </>
        )}
        <Tile
          label="Lost / damaged"
          value={numberFormat.format(thisMonth.loss.entries)}
          detail={withCost && thisMonth.loss.value > 0 ? `${rupees.format(thisMonth.loss.value)} this month` : 'Entries this month'}
          tone={thisMonth.loss.entries > 0 ? 'danger' : 'default'}
          to="/centring/movements"
        />
      </Tiles>
      <MonthList
        month={data.month}
        rows={[
          { label: 'Purchased', detail: count(thisMonth.purchase.entries, 'entry', 'entries'), amount: value(thisMonth.purchase), to: '/centring/movements' },
          { label: 'Issued', detail: count(thisMonth.issue.entries, 'entry', 'entries'), amount: value(thisMonth.issue), to: '/centring/movements' },
          { label: 'Transferred', detail: count(thisMonth.transfer.entries, 'entry', 'entries'), amount: withCost ? '' : undefined, to: '/centring/movements' },
        ]}
      />
    </DashboardCard>
  );
}
