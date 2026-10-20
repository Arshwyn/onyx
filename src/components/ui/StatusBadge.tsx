import React from 'react';

export type BadgeStatus = 'done' | 'skipped' | 'swapped' | 'pr';

const STATUS_STYLES: Record<BadgeStatus, { label: string; bg: string; color: string; border: string }> = {
  done: { label: 'DONE', bg: 'rgba(34,197,94,0.15)', color: '#4ade80', border: 'rgba(34,197,94,0.4)' },
  pr: { label: 'PR', bg: 'rgba(250,204,21,0.15)', color: '#facc15', border: 'rgba(250,204,21,0.4)' },
  skipped: { label: 'SKIPPED', bg: 'rgba(239,68,68,0.12)', color: '#f87171', border: 'rgba(239,68,68,0.35)' },
  swapped: { label: 'SWAPPED', bg: 'rgba(251,146,60,0.12)', color: '#fb923c', border: 'rgba(251,146,60,0.35)' },
};

interface StatusBadgeProps {
  status: BadgeStatus;
  label?: string; // override the default label text (status colors still apply)
}

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  const s = STATUS_STYLES[status];
  return (
    <span
      style={{ background: s.bg, color: s.color, borderColor: s.border }}
      className="text-[9px] font-extrabold border rounded px-1.5 py-0.5 tracking-wide shrink-0"
    >
      {label ?? s.label}
    </span>
  );
}
