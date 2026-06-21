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
    <div className="w-full py-0">
      <section className="relative overflow-hidden bg-violet-950 px-6 py-12 text-white shadow-2xl shadow-violet-950/20 sm:px-8 sm:py-14 lg:px-12 lg:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.26),_transparent_35%),radial-gradient(circle_at_80%_20%,_rgba(99,102,241,0.2),_transparent_30%),linear-gradient(135deg,_rgba(43,16,82,0.98),_rgba(20,10,45,0.99))]" />
        <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />
        <div className="absolute -left-12 top-12 h-44 w-44 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute -right-10 bottom-4 h-56 w-56 rounded-full bg-violet-400/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="space-y-6 lg:pt-2">
            <div className="inline-flex rounded-full border border-violet-300/30 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-violet-200">
              Education payments
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
              Fast, lower-cost university payments
            </h1>
            <p className="max-w-xl text-lg leading-8 text-slate-300 sm:text-xl">
              Move tuition with fewer steps, clearer pricing, and faster settlement.
            </p>

            <div className="flex flex-wrap gap-3 text-sm text-slate-100/90">
              {['Lower fees', 'Simple FX', 'Quick settlement'].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-sm"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                className="rounded-full bg-amber-300 px-6 py-3 text-base font-semibold text-amber-950 shadow-lg shadow-amber-300/20 hover:bg-amber-200"
                onClick={() =>
                  document
                    .getElementById('demo-login')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              >
                Start a payment
              </Button>
              <span className="flex items-center text-sm text-slate-300">
                Built for university payments only.
              </span>
            </div>
          </div>

          <div id="demo-login" className="lg:pt-4">
            <Card className="relative border-white/10 bg-white/95 p-6 text-slate-900 shadow-2xl shadow-violet-950/20 backdrop-blur sm:p-7 lg:sticky lg:top-8">
              <div className="space-y-5">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-600">
                    Demo login
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                    Sign in to continue
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Pick a role and jump into the education-payment flow.
                  </p>
                </div>

                <div className="grid gap-3">
                  {ACCOUNTS.map((account) => (
                    <button
                      type="button"
                      key={account.email}
                      onClick={() => setEmail(account.email)}
                      className={`rounded-2xl border p-4 text-left transition ${email === account.email ? 'border-brand-500 bg-brand-50 shadow-sm ring-2 ring-brand-100' : 'border-slate-200 bg-white hover:border-brand-200'}`}
                    >
                      <div className="font-semibold text-slate-900">{account.label}</div>
                      <div className="mt-1 text-sm leading-6 text-slate-500">
                        {account.description}
                      </div>
                    </button>
                  ))}
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
                  <Button
                    className="w-full rounded-full py-3.5 text-base font-semibold"
                    onClick={() => void login()}
                  >
                    Sign in
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
