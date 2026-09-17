export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white">
        T
      </div>
      <span className="text-lg font-semibold tracking-tight text-foreground">
        TrueMail
      </span>
    </div>
  );
}
