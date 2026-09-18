import { type ReactNode } from "react";
import { BrandMark } from "@/components/BrandMark";
import { cn } from "@/lib/cn";

export function AuthShell({
  wide = false,
  children,
}: {
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen">
      <aside className="bg-ink relative hidden w-[38%] shrink-0 flex-col justify-between overflow-hidden p-10 lg:flex">
        <div className="bg-grain-texture pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay" />
        <BrandMark light className="relative" />
        <p className="relative max-w-xs font-mono text-sm leading-relaxed text-white/45">
          Email infrastructure,
          <br />
          without the clutter.
        </p>
      </aside>
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className={cn("w-full", wide ? "max-w-md" : "max-w-sm")}>
          <BrandMark className="mb-10 lg:hidden" />
          {children}
        </div>
      </div>
    </main>
  );
}
