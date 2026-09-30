import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { homeFor } from '../utils/format.js';

const DEMO = [
  { label: 'Patient', email: 'patient@aarogya.test', password: 'Patient@123' },
  { label: 'Insurer', email: 'insurer@aarogya.test', password: 'Insurer@123' },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const u = await login(form.email, form.password);
      const from = location.state?.from;
      // Only honour the "return to" path if it belongs to this user's portal.
      navigate(from && from.startsWith(homeFor(u.role)) ? from : homeFor(u.role), { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <section className="panel">
        <h1>Sign in</h1>
        <p className="muted">Patients submit and track claims. Insurers review them.</p>
        <form onSubmit={submit} className="form" noValidate>
          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </label>
          {error && <div className="alert alert--error" role="alert">{error}</div>}
          <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </section>
      <aside className="panel panel--soft">
        <h2>Demo accounts</h2>
        <p className="muted">Select one to fill the form.</p>
        <div className="stack">
          {DEMO.map((d) => (
            <button key={d.label} type="button" className="demo" onClick={() => setForm({ email: d.email, password: d.password })}>
              <strong>{d.label}</strong>
              <span>{d.email}</span>
              <span>{d.password}</span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
