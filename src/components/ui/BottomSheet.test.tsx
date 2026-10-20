import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BottomSheet from './BottomSheet';

describe('BottomSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <BottomSheet isOpen={false} onClose={() => {}}>content</BottomSheet>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('exposes dialog semantics when open', () => {
    render(
      <BottomSheet isOpen={true} onClose={() => {}} title="Plate Calculator">content</BottomSheet>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Plate Calculator');
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<BottomSheet isOpen={true} onClose={onClose}>content</BottomSheet>);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not respond to Escape when closed', () => {
    const onClose = vi.fn();
    render(<BottomSheet isOpen={false} onClose={onClose}>content</BottomSheet>);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the overlay is clicked but not when the sheet content is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <BottomSheet isOpen={true} onClose={onClose} title="Plate Calculator">
        <button>Inside</button>
      </BottomSheet>
    );

    await user.click(screen.getByText('Inside'));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();

    // The overlay is the dialog's parent -- click it directly via its role-less wrapper.
    await user.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose from the close (X) button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<BottomSheet isOpen={true} onClose={onClose} title="Plate Calculator">content</BottomSheet>);

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// Makes the hardware/gesture back action close the sheet instead of leaving
// the screen underneath it -- see the effect's own comments in BottomSheet.tsx
// for why the push is deferred to a microtask (a React StrictMode dev-only
// double-invoke races pushState against history.back()'s async pop) and why
// the popstate handler/cleanup re-check window.history.state instead of
// trusting a plain "did a pop happen" flag.
describe('BottomSheet back-gesture integration', () => {
  it('pushes a same-URL history entry once open, deferred to a microtask', async () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    render(<BottomSheet isOpen={true} onClose={() => {}} title="Test">content</BottomSheet>);

    expect(pushSpy).not.toHaveBeenCalled(); // still deferred
    await Promise.resolve();

    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.calls[0][0]).toHaveProperty('onyxSheet');
    pushSpy.mockRestore();
  });

  it('pops its own entry back off when closed via isOpen flipping to false', async () => {
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const { rerender } = render(<BottomSheet isOpen={true} onClose={() => {}} title="Test">content</BottomSheet>);
    await Promise.resolve();

    rerender(<BottomSheet isOpen={false} onClose={() => {}} title="Test">content</BottomSheet>);
    expect(backSpy).toHaveBeenCalledTimes(1);
    backSpy.mockRestore();
  });

  it('closes when a back gesture pops the pushed entry', async () => {
    const onClose = vi.fn();
    render(<BottomSheet isOpen={true} onClose={onClose} title="Test">content</BottomSheet>);
    await Promise.resolve();

    // Simulates what a real back gesture looks like from script: the
    // browser has already moved off our pushed entry by the time the
    // popstate event reaches us.
    window.history.replaceState({ idx: 0 }, '');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores a popstate that fires while its own entry is still on top', async () => {
    const onClose = vi.fn();
    render(<BottomSheet isOpen={true} onClose={onClose} title="Test">content</BottomSheet>);
    await Promise.resolve();

    // Nothing actually moved history.state -- this is the shape of the
    // stale/leftover popstate the StrictMode-safety guard exists for.
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(onClose).not.toHaveBeenCalled();
  });
});
