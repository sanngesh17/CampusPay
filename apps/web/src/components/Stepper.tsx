const STEPS = ['Onboarding', 'Create', 'Documents', 'Quote', 'Status'];

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
      {STEPS.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'todo';
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                state === 'done'
                  ? 'bg-brand-600 text-white'
                  : state === 'active'
                    ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-200'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {i + 1}
            </span>
            <span
              className={state === 'active' ? 'font-semibold text-slate-800' : 'text-slate-400'}
            >
              {label}
            </span>
            {i < STEPS.length - 1 ? (
              <span className="mx-1 hidden h-px w-6 bg-slate-200 sm:block" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
