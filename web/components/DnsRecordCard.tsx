"use client";

import { useState } from "react";

type DnsRecord = {
  record: string;
  name: string;
  type: string;
  value: string;
  priority?: number;
};

export function DnsRecordCard({ record }: { record: DnsRecord }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(record.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-md border border-black/10 p-4 dark:border-white/15">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {record.record} · {record.type}
      </p>
      <p className="mb-1 break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">
        {record.name}
      </p>
      <div className="flex items-center gap-2">
        <p className="flex-1 break-all font-mono text-xs">{record.value}</p>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-md border border-black/10 px-2 py-1 text-xs font-medium transition-colors hover:bg-black/[.03] dark:border-white/15 dark:hover:bg-white/[.05]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
