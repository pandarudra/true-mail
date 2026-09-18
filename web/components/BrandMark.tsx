import Image from "next/image";

export function BrandMark({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image src="/icon.png" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
      <span
        className={`text-lg font-semibold tracking-tight ${light ? "text-white" : "text-foreground"}`}
      >
        TrueMail
      </span>
    </div>
  );
}
