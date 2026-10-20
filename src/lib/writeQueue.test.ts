import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { enqueueWrite, getQueuedWrites, removeQueuedWrite, getQueuedWriteCount } from './writeQueue';

// jsdom doesn't implement IndexedDB, so this file polyfills it via
// fake-indexeddb rather than mocking writeQueue.ts itself (see
// dataManager.test.ts, which does mock this module — that's the right
// choice there since dataManager's tests care about write-queueing
// decisions, not IndexedDB persistence itself).
beforeEach(async () => {
  const existing = await getQueuedWrites();
  await Promise.all(existing.map((entry) => removeQueuedWrite(entry.id)));
});

describe('writeQueue', () => {
  it('starts empty', async () => {
    expect(await getQueuedWrites()).toEqual([]);
    expect(await getQueuedWriteCount()).toBe(0);
  });

  it('enqueues writes and returns them in insertion order', async () => {
    await enqueueWrite('addLog', ['2026-01-01', 3, [{ reps: 10, weight: 100 }]]);
    await enqueueWrite('deleteLog', [7]);

    const entries = await getQueuedWrites();

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ type: 'addLog', args: ['2026-01-01', 3, [{ reps: 10, weight: 100 }]] });
    expect(entries[1]).toMatchObject({ type: 'deleteLog', args: [7] });
    expect(entries[0].id).toBeLessThan(entries[1].id);
    expect(await getQueuedWriteCount()).toBe(2);
  });

  it('removes an entry by id without disturbing the others', async () => {
    await enqueueWrite('addLog', ['2026-01-01', 3, []]);
    await enqueueWrite('deleteLog', [7]);
    const [first, second] = await getQueuedWrites();

    await removeQueuedWrite(first.id);

    const remaining = await getQueuedWrites();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
  });
});
