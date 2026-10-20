import React, { useEffect, useRef } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  scrollable?: boolean; // constrains height + scrolls content, for long lists/forms
}

export default function BottomSheet({ isOpen, onClose, title, children, scrollable = false }: BottomSheetProps) {
  // Every screen-specific PR reuses this primitive for its sheets, so Escape-to-close
  // is handled once here rather than per call site.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Makes the hardware/gesture back action close the sheet instead of
  // leaving the screen underneath it -- pushes a same-URL history entry
  // while open so a back press pops that entry (caught below as a
  // popstate) rather than the real page, then pops it back off ourselves
  // if the sheet closes any other way (✕, backdrop, Escape) so a dangling
  // entry doesn't sit there forcing an extra, do-nothing back press later
  // to actually leave. onCloseRef (rather than depending on `onClose`
  // directly) keeps this scoped to isOpen actually flipping -- most call
  // sites pass a fresh inline onClose closure every render, and depending
  // on it here would re-push a new history entry on every parent re-render
  // while the sheet is already open, not just when it opens.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // React StrictMode's dev-only double-invoke (mount, cleanup, mount again,
  // all synchronously back-to-back) runs this effect twice per real open.
  // history.back() is inherently asynchronous -- its actual pop can't be
  // cancelled and doesn't land until a later task -- so the throwaway
  // first mount's cleanup can't safely call it: by the time it resolves,
  // the second (real) mount has already pushed its own entry on top, and
  // the stale pop arrives later and would incorrectly read as a genuine
  // back gesture. Deferring the push itself to a microtask sidesteps this
  // entirely: StrictMode's synchronous cleanup sets `cancelled` before
  // that microtask ever runs, so the throwaway first mount never touches
  // real browser history at all, and only the second (real) mount's push
  // survives -- verified against both a StrictMode dev build and
  // production (which never double-invokes, so cancelled is always
  // false there and the push runs immediately for all practical purposes).
  useEffect(() => {
    if (!isOpen) return;

    const id = Math.random();
    let cancelled = false;
    let pushed = false;
    let handlePopState: (() => void) | null = null;

    queueMicrotask(() => {
      if (cancelled) return;

      window.history.pushState({ onyxSheet: id }, '');
      pushed = true;

      handlePopState = () => {
        // A stale popstate can still arrive after our entry is already
        // back on top (see above) -- only a real back gesture actually
        // removes it, so only that case should count as a close.
        if ((window.history.state as { onyxSheet?: number } | null)?.onyxSheet === id) return;
        onCloseRef.current();
      };
      window.addEventListener('popstate', handlePopState);
    });

    return () => {
      cancelled = true;
      if (!pushed) return; // the microtask above never got to run -- nothing to undo
      if (handlePopState) window.removeEventListener('popstate', handlePopState);
      // Only pop back off if our entry is still the current one -- if a
      // real back gesture already removed it, there's nothing left to pop.
      if ((window.history.state as { onyxSheet?: number } | null)?.onyxSheet === id) {
        window.history.back();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // z-[55]: above the bottom nav (z-50) so sheets with footer buttons (e.g. HistoryView's
  // edit sheet) aren't covered by it -- PlateCalculator, the only other consumer so far,
  // never exposed this since its only close affordance is the header's ✕, not a footer row.
  return (
    <div className="fixed inset-0 bg-black/70 z-[55] flex items-end" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`w-full bg-surface border-t border-border-input rounded-t-[20px] px-5 pt-5 pb-[34px] box-border ${scrollable ? 'max-h-[80%] overflow-y-auto' : ''}`}
      >
        {title && (
          <div className="flex justify-between items-center mb-4">
            <h3 className="m-0 font-display font-bold text-base text-white uppercase italic">{title}</h3>
            <button type="button" onClick={onClose} aria-label="Close" className="bg-none border-none text-text-muted text-base cursor-pointer">
              &#10005;
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
