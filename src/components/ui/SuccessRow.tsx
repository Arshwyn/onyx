import React from 'react';

interface SuccessRowProps {
  label: string;
  value: string;
  onClick?: () => void;
}

// Green "logged" state row -- used for morning body weight, measurements, etc.
export default function SuccessRow({ label, value, onClick }: SuccessRowProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2.5 bg-success-bg border border-success-border rounded-card px-3.5 py-2.5 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="w-[26px] h-[26px] rounded-pill bg-[rgba(74,222,128,0.15)] flex items-center justify-center text-success text-sm">
        &#10003;
      </div>
      <div>
        <div className="text-[9px] uppercase tracking-wide text-success font-bold">{label}</div>
        <div className="font-mono text-sm text-white font-semibold">{value}</div>
      </div>
    </div>
  );
}
