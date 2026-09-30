import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import DocumentViewer from '../components/DocumentViewer.jsx';
import { PageSkeleton } from '../components/Skeleton.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, formatDateTime, formatMoney, shortId } from '../utils/format.js';

export default function ClaimReview() {
  const { id } = useParams();
  const [claim, setClaim] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [decision, setDecision] = useState('Approved');
  const [amount, setAmount] = useState('');
  const [comments, setComments] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');

  const hydrate = (c) => {
    setClaim(c);
    setDecision(c.status === 'Rejected' ? 'Rejected' : 'Approved');
    setAmount(String(c.approvedAmount ?? c.claimAmount));
    setComments(c.insurerComments);
  };

  useEffect(() => {
    const controller = new AbortController();
    setClaim(null);
    setLoadError('');
    api.getClaim(id, controller.signal).then((r) => hydrate(r.claim)).catch((err) => err.name !== 'AbortError' && setLoadError(err.message));
    return () => controller.abort();
  }, [id]);

  if (loadError) {
    return (
      <div className="panel empty">
        <h1>Claim unavailable</h1><p>{loadError}</p>
        <Link className="btn" to="/insurer">Back to claims</Link>
      </div>
    );
  }
  if (!claim) return <PageSkeleton />;

  const submit = async (e) => {
    e.preventDefault();
    setSaved('');
    const found = {};
    if (decision === 'Approved') {
      const n = Number(amount);
      if (!(n > 0)) found.approvedAmount = 'Enter an amount greater than 0';
      else if (n > claim.claimAmount) found.approvedAmount = `Cannot exceed the claimed ${formatMoney(claim.claimAmount)}`;
    } else if (!comments.trim()) found.insurerComments = 'Add a comment explaining the rejection';
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const res = await api.reviewClaim(id, {
        status: decision,
        approvedAmount: decision === 'Approved' ? Number(amount) : undefined,
        insurerComments: comments,
      });
      hydrate(res.claim);
      setSaved(`Claim ${res.claim.status.toLowerCase()}.`);
    } catch (err) {
      setErrors(err instanceof ApiError && err.details?.length ? err.fieldErrors() : { form: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <Link className="link" to="/insurer">← All claims</Link>
          <h1>Claim #{shortId(claim.id)} <StatusBadge status={claim.status} /></h1>
        </div>
      </div>

      <div className="review">
        <section className="panel">
          <h2>Claim details</h2>
          <dl className="details">
            <dt>Patient</dt><dd>{claim.name}</dd>
            <dt>Email</dt><dd>{claim.email}</dd>
            <dt>Submitted</dt><dd>{formatDate(claim.submissionDate)}</dd>
            <dt>Amount claimed</dt><dd>{formatMoney(claim.claimAmount)}</dd>
            {claim.status === 'Approved' && (<><dt>Amount approved</dt><dd>{formatMoney(claim.approvedAmount)}</dd></>)}
            {claim.reviewedAt && (<><dt>Last reviewed</dt><dd>{formatDateTime(claim.reviewedAt)}</dd></>)}
            <dt>Description</dt><dd className="pre">{claim.description}</dd>
          </dl>
          <h2>Supporting document</h2>
          <DocumentViewer documentId={claim.documentId} name={claim.documentName} />
        </section>

        <form className="panel form" onSubmit={submit} noValidate>
          <h2>{claim.status === 'Pending' ? 'Your decision' : 'Update decision'}</h2>
          <fieldset className="choice">
            <legend className="sr-only">Decision</legend>
            {['Approved', 'Rejected'].map((d) => (
              <label key={d} className={`choice__opt ${decision === d ? 'is-on' : ''}`}>
                <input type="radio" name="decision" value={d} checked={decision === d} onChange={() => { setDecision(d); setErrors({}); }} />
                {d === 'Approved' ? 'Approve' : 'Reject'}
              </label>
            ))}
          </fieldset>

          {decision === 'Approved' && (
            <label className="field">
              <span>Approved amount (₹)</span>
              <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              {errors.approvedAmount && <span className="field-error" role="alert">{errors.approvedAmount}</span>}
            </label>
          )}
          <label className="field">
            <span>Comments {decision === 'Rejected' ? '' : '(optional)'}</span>
            <textarea rows={4} maxLength={2000} value={comments} onChange={(e) => setComments(e.target.value)} />
            {errors.insurerComments && <span className="field-error" role="alert">{errors.insurerComments}</span>}
          </label>

          {errors.form && <div className="alert alert--error" role="alert">{errors.form}</div>}
          {saved && <div className="alert alert--ok" role="status">{saved}</div>}
          <button className="btn" disabled={saving}>{saving ? 'Saving…' : decision === 'Approved' ? 'Approve claim' : 'Reject claim'}</button>
        </form>
      </div>
    </>
  );
}
