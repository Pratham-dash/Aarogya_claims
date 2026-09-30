import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { compressImage } from '../utils/compressImage.js';

const MAX_MB = 10;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function Field({ label, hint, error, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && !error && <small className="muted">{hint}</small>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </label>
  );
}

export default function SubmitClaim() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: user.name, email: user.email, claimAmount: '', description: '' });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Enter your full name';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email address';
    if (!(Number(form.claimAmount) > 0)) e.claimAmount = 'Enter an amount greater than 0';
    if (form.description.trim().length < 10) e.description = 'Describe the claim in at least 10 characters';
    if (!file) e.document = 'Attach a receipt or prescription';
    else if (!TYPES.includes(file.type)) e.document = 'Use a JPG, PNG, WebP or PDF file';
    else if (file.size > MAX_MB * 1024 * 1024) e.document = `File must be smaller than ${MAX_MB} MB`;
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    const found = validate();
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      const upload = await compressImage(file);
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, v));
      body.append('document', upload);
      await api.createClaim(body);
      navigate('/patient', { state: { flash: 'Claim submitted. You can track its status below.' } });
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) setErrors(err.fieldErrors());
      setFormError(err.message);
      setBusy(false);
    }
  };

  return (
    <section className="panel panel--narrow">
      <h1>Submit a claim</h1>
      <form className="form" onSubmit={submit} noValidate>
        <div className="grid-2">
          <Field error={errors.name} label="Name"><input value={form.name} onChange={set('name')} autoComplete="name" /></Field>
          <Field error={errors.email} label="Email"><input type="email" value={form.email} onChange={set('email')} autoComplete="email" /></Field>
        </div>
        <Field error={errors.claimAmount} label="Claim amount (₹)">
          <input type="number" inputMode="decimal" min="0" step="0.01" value={form.claimAmount} onChange={set('claimAmount')} />
        </Field>
        <Field error={errors.description} label="Description" hint="What was the treatment or expense?">
          <textarea rows={4} maxLength={2000} value={form.description} onChange={set('description')} />
        </Field>
        <Field error={errors.document} label="Receipt or prescription" hint={`JPG, PNG, WebP or PDF, up to ${MAX_MB} MB. Photos are compressed automatically.`}>
          <input type="file" accept={TYPES.join(',')} onChange={(e) => setFile(e.target.files[0] ?? null)} />
        </Field>
        {formError && <div className="alert alert--error" role="alert">{formError}</div>}
        <div className="actions">
          <button className="btn" disabled={busy}>{busy ? 'Submitting…' : 'Submit claim'}</button>
          <Link className="btn btn--ghost" to="/patient">Cancel</Link>
        </div>
      </form>
    </section>
  );
}
