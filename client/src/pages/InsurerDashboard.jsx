import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import Pagination from '../components/Pagination.jsx';
import { Skeleton, StatsSkeleton, TableSkeleton } from '../components/Skeleton.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useClaimsQuery } from '../hooks/useClaimsQuery.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { dayEndISO, dayStartISO, formatDate, formatMoney, shortId } from '../utils/format.js';

const EMPTY = { status: '', dateFrom: '', dateTo: '', minAmount: '', maxAmount: '', sort: 'newest' };

function Stats() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    api.claimStats(controller.signal).then(setStats).catch(() => {});
    return () => controller.abort();
  }, []);
  if (!stats) return <StatsSkeleton />;
  const items = [
    ['Total claims', stats.total],
    ['Pending review', stats.pending],
    ['Approved', stats.approved],
    ['Amount approved', formatMoney(stats.totalApproved)],
  ];
  return (
    <div className="stats">
      {items.map(([label, value]) => (
        <div className="stat" key={label}><span className="muted">{label}</span><strong>{value}</strong></div>
      ))}
    </div>
  );
}

export default function InsurerDashboard() {
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);
  // Amount inputs update instantly in the UI, but the API is only queried once typing pauses.
  const minAmount = useDebounce(filters.minAmount);
  const maxAmount = useDebounce(filters.maxAmount);

  const update = (key) => (e) => {
    setFilters((f) => ({ ...f, [key]: e.target.value }));
    setPage(1);
  };

  const { data, loading, error, retry } = useClaimsQuery({
    page,
    limit: 10,
    status: filters.status,
    sort: filters.sort,
    minAmount,
    maxAmount,
    dateFrom: dayStartISO(filters.dateFrom),
    dateTo: dayEndISO(filters.dateTo),
  });

  const hasFilters = Object.entries(filters).some(([k, v]) => v !== EMPTY[k]);
  const badRange = filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo;

  return (
    <>
      <div className="page-head"><h1>Claims</h1></div>
      <Stats />

      <section className="filters" aria-label="Filters">
        <label className="field field--inline"><span>Status</span>
          <select value={filters.status} onChange={update('status')}>
            <option value="">All</option><option>Pending</option><option>Approved</option><option>Rejected</option>
          </select>
        </label>
        <label className="field field--inline"><span>From</span><input type="date" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={update('dateFrom')} /></label>
        <label className="field field--inline"><span>To</span><input type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={update('dateTo')} /></label>
        <label className="field field--inline"><span>Min ₹</span><input type="number" min="0" value={filters.minAmount} onChange={update('minAmount')} /></label>
        <label className="field field--inline"><span>Max ₹</span><input type="number" min="0" value={filters.maxAmount} onChange={update('maxAmount')} /></label>
        <label className="field field--inline"><span>Sort</span>
          <select value={filters.sort} onChange={update('sort')}>
            <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
            <option value="amount_desc">Amount: high to low</option><option value="amount_asc">Amount: low to high</option>
          </select>
        </label>
        {hasFilters && <button className="btn btn--ghost btn--sm" onClick={() => { setFilters(EMPTY); setPage(1); }}>Clear filters</button>}
      </section>
      {badRange && <div className="alert alert--error">The "To" date must be on or after the "From" date.</div>}

      {error && <div className="alert alert--error" role="alert">{error} <button className="link" onClick={retry}>Try again</button></div>}
      {!data && loading && <TableSkeleton cols={7} />}
      {data && data.items.length === 0 && (
        <div className="panel empty"><h2>No claims match</h2><p>Change or clear the filters to see more claims.</p></div>
      )}
      {data && data.items.length > 0 && (
        <div className={`table-wrap ${loading ? 'is-loading' : ''}`}>
          <table className="table">
            <thead>
              <tr>
                <th>Claim</th><th>Patient</th><th>Submitted</th><th className="num">Claimed</th>
                <th>Status</th><th className="num">Approved</th><th><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id}>
                  <td>#{shortId(c.id)}</td>
                  <td className="wrap"><strong>{c.name}</strong><br /><small className="muted">{c.email}</small></td>
                  <td>{formatDate(c.submissionDate)}</td>
                  <td className="num">{formatMoney(c.claimAmount)}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className="num">{c.status === 'Approved' ? formatMoney(c.approvedAmount) : '—'}</td>
                  <td><Link className="btn btn--sm" to={`/insurer/claims/${c.id}`}>{c.status === 'Pending' ? 'Review' : 'Open'}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data ? <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} /> : loading ? <Skeleton w="30%" /> : null}
    </>
  );
}
