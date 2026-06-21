import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, ErrorNote, Field, TextInput } from '../components/ui';

const ACCOUNTS = [
  {
    label: 'Student',
    email: 'student@tuitionflow.local',
    description: 'Create and track tuition payments',
  },
  {
    label: 'University finance',
    email: 'finance-warwick@tuitionflow.local',
    description: 'Track Warwick student payment initiations',
  },
  {
    label: 'Lender officer',
    email: 'lender@tuitionflow.local',
    description: 'Approve sanctioned-loan disbursements',
  },
  {
    label: 'Payment ops',
    email: 'ops@tuitionflow.local',
    description: 'Handle settlement operations and exceptions',
  },
];

export function LoginScreen() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(ACCOUNTS[0]!.email);
  const [password, setPassword] = useState('DemoPass123!');
  const [error, setError] = useState('');

  if (auth.user) return <Navigate to="/dashboard" replace />;

  async function login() {
    try {
      setError('');
      await auth.login(email, password);
      navigate('/dashboard');
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <>
      <header className="dashboard-header">
        <span className="eyebrow">Attention-Anchored Payments</span>
        <h1>
          Decentralized tuition, <span>sponsor funded.</span>
        </h1>
        <p>Offset transaction fees while payment corridors process on-chain.</p>
      </header>

      <Card className="p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <span className="mono-label">Demo login</span>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
              Sign in to continue
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
              Pick a role and jump into the education-payment flow.
            </p>
            <div className="mt-5 grid gap-3">
              {ACCOUNTS.map((account) => (
                <button
                  type="button"
                  key={account.email}
                  onClick={() => setEmail(account.email)}
                  className={`list-row !grid-cols-[1fr_auto] !rounded-xl border text-left ${
                    email === account.email
                      ? 'border-[var(--accent)] bg-[var(--accent-bg)]'
                      : 'border-[var(--border)] bg-[var(--surface)]'
                  }`}
                >
                  <div className="cell-student">
                    {account.label}
                    <span className="cell-email">{account.description}</span>
                  </div>
                  <span className="cell-ref">{account.email.split('@')[0]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Field label="Email">
              <TextInput value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <Field label="Password">
              <TextInput
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <ErrorNote message={error} />
            <Button className="w-full" onClick={() => void login()}>
              Sign in &rarr;
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
