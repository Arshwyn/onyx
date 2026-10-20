import React from 'react';

interface MicroLabelProps {
  children: React.ReactNode;
  muted?: boolean; // #52525b (faint) vs #71717a (muted) -- both used across the spec
  className?: string;
}

export default function MicroLabel({ children, muted = false, className = '' }: MicroLabelProps) {
  return (
    <span className={`text-[10px] font-bold uppercase tracking-[0.06em] ${muted ? 'text-text-faint' : 'text-text-muted'} ${className}`}>
      {children}
    </span>
  );
}
