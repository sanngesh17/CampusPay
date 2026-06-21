import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const FEATURES = [
  ['Student intake', 'Collect semester, fee, lender, and payer details once.'],
  ['Lender review', 'Approve sanctioned-loan releases from a focused queue.'],
  ['University view', 'See every initiated payment for the partner college.'],
  ['Operations control', 'Handle funding, payout, and reconciliation without email chains.'],
] as const;

export function LandingScreen() {
  const { user } = useAuth();

  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="landing-page">
      <section className="landing-hero">
        <span className="eyebrow landing-eyebrow">CampusPay for education finance</span>
        <h1>
          One source of truth for <span>tuition payments.</span>
        </h1>
        <p>No more email chains. One queue, one status, one shared record.</p>
        <div className="landing-actions">
          <Link to="/login" className="btn-primary">
            Open workspace &rarr;
          </Link>
        </div>
      </section>

      <section className="landing-features" aria-label="CampusPay modules">
        {FEATURES.map(([title, copy], index) => (
          <article key={title} className="landing-feature">
            <span className="landing-feature-index">{index + 1}</span>
            <h2>{title}</h2>
            <p>{copy}</p>
          </article>
        ))}
      </section>

      <footer className="landing-footer">
        <span>CampusPay</span>
        <span>Built for education finance teams.</span>
      </footer>
    </div>
  );
}
