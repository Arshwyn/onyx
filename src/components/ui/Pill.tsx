import React from 'react';

interface PillProps {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  mono?: boolean;
  disabled?: boolean;
  className?: string;
}

// Generic rounded chip/pill button. Filled-blue when active, dark/bordered otherwise --
// matches the bar-weight, unit, and body-part chip treatment across the redesign.
export default function Pill({ children, onClick, active = false, mono = false, disabled = false, className = '' }: PillProps) {
  const base = active
    ? 'bg-accent border-accent text-white'
    : 'bg-[#141416] border-border-input text-text-tertiary';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${mono ? 'font-mono' : 'font-display'} text-xs font-bold px-2.5 py-1.5 rounded-pill border transition-colors disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}
