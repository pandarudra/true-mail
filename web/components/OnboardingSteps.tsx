import { Check } from "@phosphor-icons/react";

const STEPS = ["Connect Resend", "Connect domain", "Create mailbox"];

export function OnboardingSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="mb-10 flex items-center gap-2">
      {STEPS.map((step, i) => {
        const stepNumber = i + 1;
        const done = stepNumber < current;
        const active = stepNumber === current;
        return (
          <li key={step} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                done
                  ? "bg-brand-800 text-white"
                  : active
                    ? "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"
                    : "bg-zinc-100 text-zinc-400 dark:bg-white/[.06]"
              }`}
            >
              {done ? <Check size={13} weight="bold" /> : stepNumber}
            </div>
            <span
              className={`hidden text-sm sm:inline ${
                active ? "font-medium text-foreground" : "text-zinc-500"
              }`}
            >
              {step}
            </span>
            {stepNumber < STEPS.length && (
              <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
