import { describe, it, expect, vi, afterEach } from 'vitest';
import { emitError, emitInfo, type Toast } from './toastBus';

const listenOnce = (): Promise<Toast> => {
  return new Promise((resolve) => {
    window.addEventListener('onyx-toast', ((e: CustomEvent<Toast>) => resolve(e.detail)) as EventListener, { once: true });
  });
};

describe('toastBus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emitInfo dispatches an onyx-toast event with type "info"', async () => {
    const received = listenOnce();
    emitInfo('saved');
    await expect(received).resolves.toMatchObject({ type: 'info', message: 'saved' });
  });

  it('emitError dispatches an onyx-toast event with type "error" while online', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const received = listenOnce();
    emitError('could not save');
    await expect(received).resolves.toMatchObject({ type: 'error', message: 'could not save' });
  });

  it('emitError is a no-op while offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const handler = vi.fn();
    window.addEventListener('onyx-toast', handler);
    emitError('should not surface');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener('onyx-toast', handler);
  });

  it('assigns increasing ids across calls', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const first = listenOnce();
    emitInfo('one');
    const firstDetail = await first;

    const second = listenOnce();
    emitInfo('two');
    const secondDetail = await second;

    expect(secondDetail.id).toBeGreaterThan(firstDetail.id);
  });
});
