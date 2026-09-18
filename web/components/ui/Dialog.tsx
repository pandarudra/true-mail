"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { DrawablyCard } from "drawably/react";
import { IconButton } from "@/components/ui/IconButton";

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-full max-w-sm bg-transparent p-0 backdrop:bg-black/40"
    >
      <DrawablyCard roughness={0.3} boil={0.1} className="bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <IconButton label="Close" onClick={onClose} className="h-7 w-7">
            <X size={14} />
          </IconButton>
        </div>
        {children}
      </DrawablyCard>
    </dialog>
  );
}
