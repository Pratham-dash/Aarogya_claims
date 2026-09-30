import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { homeFor } from '../utils/format.js';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <header className="topbar">
        <div className="container topbar__inner">
          <Link to={user ? homeFor(user.role) : '/login'} className="brand">
            <span className="brand__mark" aria-hidden="true">+</span>
            Aarogya Claims
          </Link>
          {user && (
            <nav className="topbar__nav" aria-label="Main">
              {user.role === 'patient' ? (
                <>
                  <NavLink to="/patient" end>My claims</NavLink>
                  <NavLink to="/patient/submit">New claim</NavLink>
                </>
              ) : (
                <NavLink to="/insurer">All claims</NavLink>
              )}
              <span className="topbar__user">{user.name}</span>
              <button className="btn btn--ghost btn--sm" onClick={signOut}>Sign out</button>
            </nav>
          )}
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
