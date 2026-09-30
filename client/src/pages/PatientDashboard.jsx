import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import DocumentLink from '../components/DocumentLink.jsx';
import Pagination from '../components/Pagination.jsx';
import { TableSkeleton } from '../components/Skeleton.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useClaimsQuery } from '../hooks/useClaimsQuery.js';
import { formatDate, formatMoney } from '../utils/format.js';

export default function PatientDashboard() {
  const flash = useLocation().state?.flash;
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, retry } = useClaimsQuery({ page, limit: 10, status });

  return (
    <>
      <div className="page-head">
        <h1>My claims</h1>
        <Link className="btn" to="/patient/submit">Submit a claim</Link>
      </div>
      {flash && <div className="alert alert--ok" role="status">{flash}</div>}

      <div className="filters">
        <label className="field field--inline">
          <span>Status</span>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option>Pending</option>
            <option>Approved</option>
            <option>Rejected</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="alert alert--error" role="alert">
          {error} <button className="link" onClick={retry}>Try again</button>
        </div>
      )}

      {!data && loading && <TableSkeleton cols={7} />}
      {data && data.items.length === 0 && (
        <div className="panel empty">
          <h2>{status ? `No ${status.toLowerCase()} claims` : 'No claims yet'}</h2>
          <p>{status ? 'Try a different status filter.' : 'Submit your first claim with a receipt or prescription.'}</p>
          {!status && <Link className="btn" to="/patient/submit">Submit a claim</Link>}
        </div>
      )}
      {data && data.items.length > 0 && (
        <div className={`table-wrap ${loading ? 'is-loading' : ''}`}>
          <table className="table">
            <thead>
              <tr>
                <th>Submitted</th><th>Description</th><th className="num">Claimed</th><th>Status</th>
                <th className="num">Approved</th><th>Insurer comments</th><th>Document</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id}>
                  <td>{formatDate(c.submissionDate)}</td>
                  <td className="wrap">{c.description}</td>
                  <td className="num">{formatMoney(c.claimAmount)}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className="num">{c.status === 'Approved' ? formatMoney(c.approvedAmount) : '—'}</td>
                  <td className="wrap">{c.insurerComments || '—'}</td>
                  <td><DocumentLink documentId={c.documentId} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}
    </>
  );
}
