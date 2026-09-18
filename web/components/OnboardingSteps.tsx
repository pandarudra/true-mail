import { Check } from "@phosphor-icons/react";
import { DrawablyDivider } from "drawably/react";

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
                    : "bg-surface-subtle text-text-muted"
              }`}
            >
              {done ? <Check size={13} weight="bold" /> : stepNumber}
            </div>
            <span
              className={`hidden text-sm sm:inline ${
                active ? "font-medium text-foreground" : "text-text-secondary"
              }`}
            >
              {step}
            </span>
            {stepNumber < STEPS.length && (
              <DrawablyDivider roughness={0.3} boil={0.1} className="flex-1" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
