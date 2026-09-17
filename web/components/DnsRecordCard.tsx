"use client";

import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";

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
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
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
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-black/10 px-2 py-1 text-xs font-medium transition-colors hover:bg-black/[.03] dark:border-white/10 dark:hover:bg-white/[.05]"
        >
          {copied ? <Check size={13} weight="bold" /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
