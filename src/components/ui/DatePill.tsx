import React from 'react';

interface DatePillProps {
  value: string;
  onChange: (value: string) => void;
  accent?: boolean; // matches WorkoutLogger's "Entry" pill styling (accent-lighter text)
  className?: string;
}

// Shared date input used by Log/History/Trends so date-selection looks and
// behaves the same everywhere. Sized to its content (no forced width) with
// enough padding/min-width to clear the native calendar-picker-indicator --
// a fixed narrow width plus tight padding was clipping the rendered date
// (mm/dd/yyyy or a locale-formatted string, depending on browser/platform).
export default function DatePill({ value, onChange, accent = true, className = '' }: DatePillProps) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-[#141416] border border-border-input rounded-pill pl-2.5 pr-1.5 py-1 ${accent ? 'text-accent-lighter' : 'text-white'} font-mono text-[11px] font-bold outline-none min-w-[122px] box-border [color-scheme:dark] ${className}`}
    />
  );
}
