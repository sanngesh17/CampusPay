import { useNavigate } from 'react-router-dom';
import { Stepper } from '../components/Stepper';
import { Button, Card, PageHeader } from '../components/ui';
import { STUDENTS } from '../lib/constants';

export function OnboardingScreen() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <Stepper current={0} />
      <PageHeader
        title="Pay your tuition, the simple way"
        subtitle="KYC is pre-verified for these students. Pick one to begin."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {STUDENTS.map((s) => (
          <Card key={s.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-semibold text-slate-800">{s.name}</div>
                <div className="text-sm text-slate-500">Studying in {s.country}</div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                <span className="text-[8px]">●</span> KYC verified
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-500">{s.blurb}</p>
            <Button className="mt-4 w-full" onClick={() => navigate(`/create?student=${s.id}`)}>
              Start a payment
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
