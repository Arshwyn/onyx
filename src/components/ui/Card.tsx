import React from 'react';

interface CardProps {
  children: React.ReactNode;
  alt?: boolean; // use the "subtle" surface variant (rest state, add-forms)
  className?: string;
  onClick?: () => void;
}

export default function Card({ children, alt = false, className = '', onClick }: CardProps) {
  return (
    <div onClick={onClick} className={`${alt ? 'bg-surface-alt' : 'bg-surface'} border border-border rounded-card p-3.5 ${className}`}>
      {children}
    </div>
  );
}
