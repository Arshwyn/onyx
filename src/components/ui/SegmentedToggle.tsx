import React from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  // Active-state bg/text differ per option in the prototype (e.g. Log's Lifting vs.
  // Cardio segments use different active colors) -- default to a neutral active style
  // when omitted.
  activeBg?: string;
  activeColor?: string;
}

interface SegmentedToggleProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export default function SegmentedToggle<T extends string>({ options, value, onChange, className = '' }: SegmentedToggleProps<T>) {
  return (
    <div className={`flex bg-[#18181b] border border-border-input rounded-lg p-1 gap-1 ${className}`}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={active ? { background: opt.activeBg ?? '#27272a', color: opt.activeColor ?? '#ffffff' } : undefined}
            className={`flex-1 py-2.5 text-[11px] font-extrabold uppercase tracking-wide rounded-md border-none cursor-pointer transition-colors ${active ? '' : 'bg-transparent text-text-muted'}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
