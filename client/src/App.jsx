import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { PageSkeleton } from './components/Skeleton.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { homeFor } from './utils/format.js';

// Route-level code splitting: each page is its own chunk, loaded on demand.
const Login = lazy(() => import('./pages/Login.jsx'));
const PatientDashboard = lazy(() => import('./pages/PatientDashboard.jsx'));
const SubmitClaim = lazy(() => import('./pages/SubmitClaim.jsx'));
const InsurerDashboard = lazy(() => import('./pages/InsurerDashboard.jsx'));
const ClaimReview = lazy(() => import('./pages/ClaimReview.jsx'));

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <PageSkeleton />;
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
}

const NotFound = () => (
  <div className="panel empty">
    <h1>Page not found</h1>
    <p>The page you are looking for does not exist.</p>
    <Link className="btn" to="/">Go to home</Link>
  </div>
);

export default function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute role="patient" />}>
            <Route path="/patient" element={<PatientDashboard />} />
            <Route path="/patient/submit" element={<SubmitClaim />} />
          </Route>
          <Route element={<ProtectedRoute role="insurer" />}>
            <Route path="/insurer" element={<InsurerDashboard />} />
            <Route path="/insurer/claims/:id" element={<ClaimReview />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
