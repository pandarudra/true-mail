"use client";

import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";
import { DrawablyBadge, DrawablyButton, DrawablyCard } from "drawably/react";

type DnsRecord = {
  record: string;
  name: string;
  type: string;
  value: string;
  priority?: number;
  status?: string;
};

const STATUS_COLOR: Record<string, string> = {
  verified: "#16a34a",
  failed: "#dc2626",
  temporary_failure: "#dc2626",
  pending: "#d97706",
  not_started: "#6b7280",
};

export function DnsRecordCard({ record }: { record: DnsRecord }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(record.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <DrawablyCard roughness={0.3} boil={0.1}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
          {record.record} · {record.type}
        </p>
        {record.status && (
          <DrawablyBadge
            roughness={0.3}
            boil={0.1}
            stroke={STATUS_COLOR[record.status] ?? STATUS_COLOR.not_started}
            className="capitalize"
          >
            {record.status.replace(/_/g, " ")}
          </DrawablyBadge>
        )}
      </div>
      <p className="mb-1 break-all font-mono text-xs text-text-secondary">{record.name}</p>
      <div className="flex items-center gap-2">
        <p className="flex-1 break-all font-mono text-xs">{record.value}</p>
        <DrawablyButton
          type="button"
          variant="outline"
          tone="neutral"
          roughness={0.3}
          boil={0.1}
          onClick={handleCopy}
          className="shrink-0 text-xs"
        >
          {copied ? <Check size={13} weight="bold" /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </DrawablyButton>
      </div>
    </DrawablyCard>
  );
}
