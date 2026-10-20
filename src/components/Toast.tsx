import React, { useEffect, useState, useCallback } from 'react';
import type { Toast as ToastMessage } from '../lib/toastBus';

const AUTO_DISMISS_MS = 5000;

interface ToastProps {
  // Whether App.tsx's offline banner is rendered above this in the same
  // fixed-position flex column (see App.tsx) — if so, Toast only needs a
  // small gap below it rather than reapplying the full safe-area-inset
  // padding, since the banner's own padding already clears the notch.
  stackedBelowBanner?: boolean;
}

export default function Toast({ stackedBelowBanner = false }: ToastProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const toast = (e as CustomEvent<ToastMessage>).detail;
      setToasts(prev => [...prev, toast]);
      setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS);
    };
    window.addEventListener('onyx-toast', handleToast);
    return () => window.removeEventListener('onyx-toast', handleToast);
  }, [dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div
      className={`flex flex-col items-center gap-2 px-4 pb-4 pointer-events-none ${
        stackedBelowBanner ? 'pt-2' : 'pt-[max(1rem,env(safe-area-inset-top))]'
      }`}
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          onClick={() => dismiss(toast.id)}
          className={`pointer-events-auto w-full max-w-md rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md animate-fade-in cursor-pointer ${
            toast.type === 'error'
              ? 'bg-red-950/90 border-red-800 text-red-200'
              : 'bg-zinc-900/90 border-zinc-700 text-zinc-200'
          }`}
        >
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      ))}
    </div>
  );
}
