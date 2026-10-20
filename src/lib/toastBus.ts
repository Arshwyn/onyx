// Lightweight pub/sub for cross-component toasts, following the app's
// existing convention of custom window events (see 'onyx-sync-complete'
// in DailyView.jsx) rather than introducing a context/state library.
export type ToastType = 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

let nextId = 1;

const emit = (type: ToastType, message: string) => {
  window.dispatchEvent(new CustomEvent<Toast>('onyx-toast', {
    detail: { id: nextId++, type, message },
  }));
};

// Skipped while offline: the persistent offline banner in App.jsx already
// communicates the root cause, so an error toast per failed fetch/write
// would just be redundant noise on top of it. Data-fetch/write failures
// that happen while online (a genuine Supabase-side error) still surface.
export const emitError = (message: string) => {
  if (!navigator.onLine) return;
  emit('error', message);
};
export const emitInfo = (message: string) => emit('info', message);
