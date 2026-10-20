import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Toast from './Toast';

const emitToast = (message: string, type: 'error' | 'info' = 'info') => {
  window.dispatchEvent(new CustomEvent('onyx-toast', { detail: { id: Date.now() + Math.random(), type, message } }));
};

describe('Toast', () => {
  it('renders nothing when there are no toasts', () => {
    const { container } = render(<Toast />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a toast dispatched via the onyx-toast event and dismisses it on click', async () => {
    render(<Toast />);

    emitToast('Saved offline — will sync automatically when back online.');
    await waitFor(() => expect(screen.getByText('Saved offline — will sync automatically when back online.')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Saved offline — will sync automatically when back online.'));
    await waitFor(() => expect(screen.queryByText('Saved offline — will sync automatically when back online.')).not.toBeInTheDocument());
  });

  // App.tsx renders the offline banner and Toast as siblings in one fixed
  // flex column (not two independently-positioned `fixed` elements needing
  // a JS-measured offset, which was prone to a race between the 'offline'
  // event and the measurement effect) — Toast just needs to know whether
  // something's already above it so it doesn't reapply the full
  // safe-area-inset padding on top of the banner's own.
  it('uses a small top gap (not the full safe-area padding) when stacked below the offline banner', async () => {
    const { container } = render(<Toast stackedBelowBanner />);
    emitToast('Synced 1 offline change.');
    await waitFor(() => expect(screen.getByText('Synced 1 offline change.')).toBeInTheDocument());

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('pt-2');
    expect(wrapper.className).not.toContain('safe-area-inset-top');
  });

  it('applies the full safe-area-inset padding when not stacked below anything', async () => {
    const { container } = render(<Toast />);
    emitToast('Could not save exercise.', 'error');
    await waitFor(() => expect(screen.getByText('Could not save exercise.')).toBeInTheDocument());

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('safe-area-inset-top');
  });
});
