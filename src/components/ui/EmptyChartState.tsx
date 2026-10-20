import React from 'react';

interface EmptyChartStateProps {
  message?: string;
}

export default function EmptyChartState({ message = 'Need at least 2 data points to show a trend.' }: EmptyChartStateProps) {
  return (
    <div className="p-6 text-center text-text-faint text-xs italic border border-dashed border-border mb-4 rounded-card">
      {message}
    </div>
  );
}
