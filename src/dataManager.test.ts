import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./supabaseClient', () => ({
  supabase: { auth: { getUser: vi.fn(), getSession: vi.fn() }, from: vi.fn(), rpc: vi.fn() },
}));
vi.mock('./lib/toastBus', () => ({
  emitError: vi.fn(),
  emitInfo: vi.fn(),
}));
vi.mock('./lib/writeQueue', () => ({
  enqueueWrite: vi.fn(),
  getQueuedWrites: vi.fn().mockResolvedValue([]),
  removeQueuedWrite: vi.fn(),
}));

import { supabase } from './supabaseClient';
import { emitError, emitInfo } from './lib/toastBus';
import { enqueueWrite, getQueuedWrites, removeQueuedWrite } from './lib/writeQueue';
import {
  getExercises,
  deleteCustomExercise,
  addExercise,
  addLog,
  getLogs,
  getLogsByDate,
  getUserSettings,
  updateUserSettings,
  getExerciseStats,
  getLastSessionSets,
  getRoutines,
  getDailyOverride,
  getDailyOverrideState,
  setDailyOverride,
  setDailyRest,
  getDailyViewBundle,
  flushWriteQueue,
} from './dataManager';

// The mocked module (see vi.mock above) doesn't share Supabase's real client
// shape, so tests interact with it as `any` rather than fighting the
// PostgrestFilterBuilder generics.
const mockSupabase = supabase as any;

// Mimics the chainable, thenable shape of a Supabase PostgrestFilterBuilder:
// every method returns the same builder, and awaiting it at any point in the
// chain resolves to the configured { data, error } result.
const makeBuilder = (result: { data: unknown; error: unknown; status?: number }) => {
  const builder: Record<string, unknown> = {};
  ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'gte', 'lte', 'in', 'lt', 'order', 'limit']
    .forEach((method) => { builder[method] = vi.fn(() => builder); });
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: (value: unknown) => void, reject: (reason: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
};

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
});

describe('getExercises', () => {
  it('merges global and custom exercises, stringifies custom ids, and sorts by name', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'global_exercises') {
        return makeBuilder({
          data: [{ id: 'ex_1', name: 'Squat' }, { id: 'ex_2', name: 'Bench Press' }],
          error: null,
        });
      }
      if (table === 'custom_exercises') {
        return makeBuilder({ data: [{ id: 5, name: 'Ab Wheel' }], error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await getExercises();

    expect(result.map((e) => e.name)).toEqual(['Ab Wheel', 'Bench Press', 'Squat']);
    expect(result.find((e) => e.name === 'Ab Wheel')?.id).toBe('5');
  });

  it('caches a successful fetch to localStorage', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'global_exercises') return makeBuilder({ data: [{ id: 'ex_1', name: 'Squat' }], error: null });
      if (table === 'custom_exercises') return makeBuilder({ data: [], error: null });
      throw new Error(`unexpected table ${table}`);
    });

    await getExercises();

    const cached = JSON.parse(localStorage.getItem('onyx_exercises_cache') ?? 'null');
    expect(cached).toEqual([{ id: 'ex_1', name: 'Squat' }]);
  });

  it('falls back to the cache (without erroring or overwriting it) when the fetch fails', async () => {
    localStorage.setItem('onyx_exercises_cache', JSON.stringify([{ id: 'ex_9', name: 'Cached Squat' }]));
    mockSupabase.from.mockImplementation(() => makeBuilder({ data: null, error: { message: 'Failed to fetch' }, status: 0 }));

    const result = await getExercises();

    expect(result).toEqual([{ id: 'ex_9', name: 'Cached Squat' }]);
    expect(emitError).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('onyx_exercises_cache') ?? 'null')).toEqual([{ id: 'ex_9', name: 'Cached Squat' }]);
  });

  it('returns an empty list and surfaces a toast when the fetch fails and there is no cache yet', async () => {
    mockSupabase.from.mockImplementation(() => makeBuilder({ data: null, error: { message: 'Failed to fetch' }, status: 0 }));

    const result = await getExercises();

    expect(result).toEqual([]);
    expect(emitError).toHaveBeenCalledWith('Could not load exercises.');
  });
});

describe('deleteCustomExercise', () => {
  it('refuses to delete anything with an ex_-prefixed (global) id', async () => {
    await deleteCustomExercise('ex_123');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('deletes a genuine custom exercise by id', async () => {
    const builder = makeBuilder({ data: null, error: null });
    mockSupabase.from.mockReturnValue(builder);

    await deleteCustomExercise(42);

    expect(mockSupabase.from).toHaveBeenCalledWith('custom_exercises');
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 42);
  });
});

describe('addExercise', () => {
  it('tags the insert with the current user id and a null mechanic by default', async () => {
    const builder = makeBuilder({ data: [{ id: 1 }], error: null });
    mockSupabase.from.mockReturnValue(builder);

    await addExercise('Cable Fly');

    expect(mockSupabase.from).toHaveBeenCalledWith('custom_exercises');
    expect(builder.insert).toHaveBeenCalledWith([
      { user_id: 'user-1', name: 'Cable Fly', category: 'Custom', mechanic: null },
    ]);
  });

  it('passes a picked mechanic through to the insert', async () => {
    const builder = makeBuilder({ data: [{ id: 1 }], error: null });
    mockSupabase.from.mockReturnValue(builder);

    await addExercise('Cable Fly', 'isolation');

    expect(builder.insert).toHaveBeenCalledWith([
      { user_id: 'user-1', name: 'Cable Fly', category: 'Custom', mechanic: 'isolation' },
    ]);
  });
});

describe('addLog', () => {
  it('tags the insert with the current user id', async () => {
    const builder = makeBuilder({ data: [{ id: 1 }], error: null });
    mockSupabase.from.mockReturnValue(builder);

    await addLog('2026-01-01', 3, [{ reps: 10, weight: 100 }]);

    expect(mockSupabase.from).toHaveBeenCalledWith('workout_logs');
    expect(builder.insert).toHaveBeenCalledWith([
      { user_id: 'user-1', date: '2026-01-01', exercise_id: '3', sets: [{ reps: 10, weight: 100 }] },
    ]);
  });
});

describe('addLog offline queueing', () => {
  it('queues the write and shows an info toast instead of an error toast when the network is unreachable', async () => {
    // status: 0 is how postgrest-js reports a fetch-level failure (see
    // PostgrestBuilder) — distinct from a genuine Postgrest/Postgres error,
    // which always carries a real HTTP status.
    const builder = makeBuilder({ data: null, error: { message: 'TypeError: Failed to fetch' }, status: 0 });
    mockSupabase.from.mockReturnValue(builder);

    const result = await addLog('2026-01-01', 3, [{ reps: 10, weight: 100 }]);

    expect(result).toBeNull();
    expect(enqueueWrite).toHaveBeenCalledWith('addLog', ['2026-01-01', 3, [{ reps: 10, weight: 100 }], 'user-1']);
    expect(emitError).not.toHaveBeenCalled();
    expect(emitInfo).toHaveBeenCalledWith('Saved offline — will sync automatically when back online.');
  });

  it('surfaces a normal error toast (and does not queue) for a genuine server-side rejection', async () => {
    const builder = makeBuilder({ data: null, error: { message: 'exercise_id violates foreign key constraint', code: '23503' }, status: 409 });
    mockSupabase.from.mockReturnValue(builder);

    const result = await addLog('2026-01-01', 3, [{ reps: 10, weight: 100 }]);

    expect(result).toBeNull();
    expect(enqueueWrite).not.toHaveBeenCalled();
    expect(emitError).toHaveBeenCalledWith('Could not save workout log.');
  });
});

describe('flushWriteQueue', () => {
  it('replays queued writes in order and removes each on success', async () => {
    (getQueuedWrites as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, type: 'addLog', args: ['2026-01-01', 3, [{ reps: 10, weight: 100 }], 'user-1'], createdAt: 1 },
      { id: 2, type: 'deleteLog', args: [7], createdAt: 2 },
    ]);
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [{ id: 99 }], error: null, status: 201 }));

    await flushWriteQueue();

    expect(removeQueuedWrite).toHaveBeenCalledWith(1);
    expect(removeQueuedWrite).toHaveBeenCalledWith(2);
    expect(emitInfo).toHaveBeenCalledWith('Synced 2 offline changes.');
  });

  it('stops at the first entry that still fails for network reasons, preserving order for the next flush', async () => {
    (getQueuedWrites as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, type: 'addLog', args: ['2026-01-01', 3, [], 'user-1'], createdAt: 1 },
      { id: 2, type: 'deleteLog', args: [7], createdAt: 2 },
    ]);
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: { message: 'Failed to fetch' }, status: 0 }));

    await flushWriteQueue();

    expect(removeQueuedWrite).not.toHaveBeenCalled();
    expect(emitInfo).not.toHaveBeenCalled();
  });

  it('drops a queued entry that fails for a genuine server-side reason on replay', async () => {
    (getQueuedWrites as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, type: 'addLog', args: ['2026-01-01', 3, [], 'user-1'], createdAt: 1 },
    ]);
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: { message: 'exercise not found', code: '23503' }, status: 409 }));

    await flushWriteQueue();

    expect(removeQueuedWrite).toHaveBeenCalledWith(1);
    expect(emitError).toHaveBeenCalledWith('A queued change could not be synced and was discarded.');
  });

  it('does nothing when the queue is empty', async () => {
    (getQueuedWrites as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await flushWriteQueue();

    expect(removeQueuedWrite).not.toHaveBeenCalled();
    expect(emitInfo).not.toHaveBeenCalled();
  });

  it('ignores an overlapping call while a flush is already in progress, to avoid double-replaying an entry', async () => {
    // App.tsx can trigger flushWriteQueue() from both a mount-time check and
    // the 'online' listener, which can race on a flaky reconnect. Without a
    // guard, two concurrent flushes would each read this same queue snapshot
    // before either removed the entry, replaying (double-submitting) it.
    let resolveGetQueuedWrites!: (value: unknown) => void;
    (getQueuedWrites as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((resolve) => { resolveGetQueuedWrites = resolve; })
    );
    mockSupabase.from.mockReturnValue(makeBuilder({ data: [{ id: 99 }], error: null, status: 201 }));

    const firstFlush = flushWriteQueue();
    const secondFlush = flushWriteQueue(); // fires while the first is still awaiting getQueuedWrites()

    resolveGetQueuedWrites([{ id: 1, type: 'addLog', args: ['2026-01-01', 3, [], 'user-1'], createdAt: 1 }]);
    await Promise.all([firstFlush, secondFlush]);

    expect(getQueuedWrites).toHaveBeenCalledTimes(1);
    expect(removeQueuedWrite).toHaveBeenCalledTimes(1);
  });
});

describe('getLogs', () => {
  it('returns an empty array and surfaces a toast when the query fails', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: { message: 'boom' } }));

    const result = await getLogs();

    expect(result).toEqual([]);
    expect(emitError).toHaveBeenCalledWith('Could not load workout logs.');
  });
});

describe('getLogsByDate (legacy throwing variant)', () => {
  it('throws rather than swallowing the error, leaving the catch to the caller', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: { message: 'boom' } }));

    await expect(getLogsByDate('2026-01-01')).rejects.toEqual({ message: 'boom' });
    expect(emitError).not.toHaveBeenCalled();
  });
});

describe('getExerciseStats', () => {
  it('returns [] without calling rpc when no exercise ids are given', async () => {
    const result = await getExerciseStats([], '2026-01-01');

    expect(result).toEqual([]);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('calls the get_exercise_stats rpc with stringified ids and returns its data', async () => {
    const rows = [{ exercise_id: '3', pr_weight: 225, last_date: '2025-12-30', last_weight: 200, last_reps: 5 }];
    mockSupabase.rpc.mockResolvedValue({ data: rows, error: null });

    const result = await getExerciseStats([3, 'ex_1'], '2026-01-01');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_exercise_stats', {
      p_exercise_ids: ['3', 'ex_1'],
      p_before_date: '2026-01-01',
    });
    expect(result).toEqual(rows);
  });

  it('returns an empty array and surfaces a toast when the rpc call fails and there is no cache yet', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const result = await getExerciseStats([3], '2026-01-01');

    expect(result).toEqual([]);
    expect(emitError).toHaveBeenCalledWith('Could not load exercise stats.');
  });

  it('caches a successful result keyed by the (sorted) exercise ids, not beforeDate', async () => {
    const rows = [{ exercise_id: '3', pr_weight: 225, last_date: '2025-12-30', last_weight: 200, last_reps: 5 }];
    mockSupabase.rpc.mockResolvedValue({ data: rows, error: null });

    await getExerciseStats([3, 1], '2026-01-01');

    // beforeDate isn't part of the key — a fetch made on any prior day
    // should still serve as today's fallback (see the comment in
    // dataManager.ts on why beforeDate would otherwise change every day).
    const cached = JSON.parse(localStorage.getItem('onyx_exercise_stats_cache_1,3') ?? 'null');
    expect(cached).toEqual(rows);
  });

  it('falls back to the cache (without a toast) when the rpc call fails', async () => {
    localStorage.setItem('onyx_exercise_stats_cache_1,3', JSON.stringify([{ exercise_id: '3', pr_weight: 100 }]));
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const result = await getExerciseStats([3, 1], '2026-01-01');

    expect(result).toEqual([{ exercise_id: '3', pr_weight: 100 }]);
    expect(emitError).not.toHaveBeenCalled();
  });
});

describe('getLastSessionSets', () => {
  it('returns {} without querying when no exercise ids are given', async () => {
    const result = await getLastSessionSets([], '2026-01-01');

    expect(result).toEqual({});
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('queries workout_logs scoped to the ids and a 120-day lookback window ending before beforeDate', async () => {
    const builder = makeBuilder({ data: [], error: null });
    mockSupabase.from.mockReturnValue(builder);

    await getLastSessionSets([3, 'ex_1'], '2026-04-01');

    expect(mockSupabase.from).toHaveBeenCalledWith('workout_logs');
    expect(builder.select).toHaveBeenCalledWith('exercise_id,date,sets');
    expect(builder.in).toHaveBeenCalledWith('exercise_id', ['3', 'ex_1']);
    expect(builder.gte).toHaveBeenCalledWith('date', '2025-12-02');
    expect(builder.lt).toHaveBeenCalledWith('date', '2026-04-01');
    expect(builder.order).toHaveBeenCalledWith('date', { ascending: false });
  });

  it('reduces newest-first rows to the first non-skipped log per exercise', async () => {
    const rows = [
      { exercise_id: '3', date: '2026-03-20', sets: [{ isSkipped: true }] },
      { exercise_id: '3', date: '2026-03-13', sets: [{ weight: 185, reps: 8 }] },
      { exercise_id: '1', date: '2026-03-18', sets: [{ weight: 100, reps: 10 }] },
      { exercise_id: '1', date: '2026-03-11', sets: [{ weight: 95, reps: 10 }] },
    ];
    mockSupabase.from.mockReturnValue(makeBuilder({ data: rows, error: null }));

    const result = await getLastSessionSets([3, 1], '2026-04-01');

    expect(result).toEqual({
      '3': { date: '2026-03-13', sets: [{ weight: 185, reps: 8 }] },
      '1': { date: '2026-03-18', sets: [{ weight: 100, reps: 10 }] },
    });
  });

  it('skips a row with an empty sets array in favor of an older row with real data', async () => {
    const rows = [
      { exercise_id: '3', date: '2026-03-20', sets: [] },
      { exercise_id: '3', date: '2026-03-13', sets: [{ weight: 185, reps: 8 }] },
    ];
    mockSupabase.from.mockReturnValue(makeBuilder({ data: rows, error: null }));

    const result = await getLastSessionSets([3], '2026-04-01');

    expect(result).toEqual({
      '3': { date: '2026-03-13', sets: [{ weight: 185, reps: 8 }] },
    });
  });

  it('returns {} and surfaces a toast when the fetch fails and there is no cache yet', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: { message: 'boom' }, status: 0 }));

    const result = await getLastSessionSets([3], '2026-01-01');

    expect(result).toEqual({});
    expect(emitError).toHaveBeenCalledWith('Could not load last session data.');
  });

  it('caches a successful result keyed by the (sorted) exercise ids, not beforeDate', async () => {
    const rows = [{ exercise_id: '3', date: '2026-03-13', sets: [{ weight: 185, reps: 8 }] }];
    mockSupabase.from.mockReturnValue(makeBuilder({ data: rows, error: null }));

    await getLastSessionSets([3, 1], '2026-04-01');

    const cached = JSON.parse(localStorage.getItem('onyx_last_sets_cache_1,3') ?? 'null');
    expect(cached).toEqual({ '3': { date: '2026-03-13', sets: [{ weight: 185, reps: 8 }] } });
  });

  it('falls back to the cache (without a toast) when the fetch fails', async () => {
    localStorage.setItem(
      'onyx_last_sets_cache_1,3',
      JSON.stringify({ '3': { date: '2026-03-13', sets: [{ weight: 185, reps: 8 }] } })
    );
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: { message: 'boom' }, status: 0 }));

    const result = await getLastSessionSets([3, 1], '2026-04-01');

    expect(result).toEqual({ '3': { date: '2026-03-13', sets: [{ weight: 185, reps: 8 }] } });
    expect(emitError).not.toHaveBeenCalled();
  });
});

describe('getRoutines', () => {
  it('caches a successful fetch and falls back to it when the fetch fails', async () => {
    mockSupabase.from.mockReturnValueOnce(makeBuilder({ data: [{ id: 'r1', day: 'Monday', name: 'Push', exercises: [] }], error: null }));
    await getRoutines();
    expect(JSON.parse(localStorage.getItem('onyx_routines_cache') ?? 'null')).toEqual([{ id: 'r1', day: 'Monday', name: 'Push', exercises: [] }]);

    mockSupabase.from.mockReturnValueOnce(makeBuilder({ data: null, error: { message: 'boom' }, status: 0 }));
    const result = await getRoutines();

    expect(result).toEqual([{ id: 'r1', day: 'Monday', name: 'Push', exercises: [] }]);
    expect(emitError).not.toHaveBeenCalled();
  });

  it('returns an empty array and surfaces a toast when the fetch fails and there is no cache yet', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: { message: 'boom' }, status: 0 }));

    const result = await getRoutines();

    expect(result).toEqual([]);
    expect(emitError).toHaveBeenCalledWith('Could not load routines.');
  });
});

describe('getDailyOverride', () => {
  it('caches a successful (non-null) result and falls back to it when the fetch fails', async () => {
    mockSupabase.from.mockReturnValueOnce(makeBuilder({ data: { routine_id: 'r1' }, error: null }));
    await getDailyOverride('2026-01-01');

    mockSupabase.from.mockReturnValueOnce(makeBuilder({ data: null, error: { message: 'boom' }, status: 0 }));
    const result = await getDailyOverride('2026-01-01');

    expect(result).toBe('r1');
    expect(emitError).not.toHaveBeenCalled();
  });

  it('caches a successful null result (no override) distinctly from "nothing cached yet"', async () => {
    mockSupabase.from.mockReturnValueOnce(makeBuilder({ data: null, error: null }));
    await getDailyOverride('2026-01-01');

    mockSupabase.from.mockReturnValueOnce(makeBuilder({ data: null, error: { message: 'boom' }, status: 0 }));
    const result = await getDailyOverride('2026-01-01');

    // Falls back to the cached "no override" result rather than treating
    // the absent-cache case (emitError + null) as the only null outcome.
    expect(result).toBeNull();
    expect(emitError).not.toHaveBeenCalled();
  });

  it('surfaces a toast when the fetch fails and there is no cache yet for that date', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: { message: 'boom' }, status: 0 }));

    const result = await getDailyOverride('2026-01-01');

    expect(result).toBeNull();
    expect(emitError).toHaveBeenCalledWith('Could not load routine override.');
  });
});

describe('daily override rest markers', () => {
  it('writes is_rest: false with a routine override', async () => {
    const builder = makeBuilder({ data: null, error: null });
    mockSupabase.from.mockReturnValue(builder);

    await setDailyOverride('2026-01-01', 'r1');

    expect(mockSupabase.from).toHaveBeenCalledWith('daily_overrides');
    expect(builder.upsert).toHaveBeenCalledWith({ user_id: 'user-1', date: '2026-01-01', routine_id: 'r1', is_rest: false });
  });

  it('writes routine_id: null and is_rest: true for a rest marker', async () => {
    const builder = makeBuilder({ data: null, error: null });
    mockSupabase.from.mockReturnValue(builder);

    await setDailyRest('2026-01-01');

    expect(builder.upsert).toHaveBeenCalledWith({ user_id: 'user-1', date: '2026-01-01', routine_id: null, is_rest: true });
  });

  it('queues a rest write when the network is unreachable', async () => {
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: { message: 'Failed to fetch' }, status: 0 }));

    await setDailyRest('2026-01-01');

    expect(enqueueWrite).toHaveBeenCalledWith('setDailyRest', ['2026-01-01', 'user-1']);
    expect(emitError).not.toHaveBeenCalled();
  });

  it('reports whether a rest write was accepted', async () => {
    mockSupabase.from.mockReturnValueOnce(makeBuilder({ data: null, error: null }));
    expect(await setDailyRest('2026-01-01')).toBe(true);

    mockSupabase.from.mockReturnValueOnce(makeBuilder({ data: null, error: { message: 'x', code: '23514' }, status: 400 }));
    expect(await setDailyRest('2026-01-01')).toBe(false);
    expect(emitError).toHaveBeenCalledWith('Could not save rest day.');
  });

  it('reads is_rest and keeps getDailyOverride returning the routine id', async () => {
    const builder = makeBuilder({ data: { routine_id: null, is_rest: true }, error: null });
    mockSupabase.from.mockReturnValue(builder);

    expect(await getDailyOverrideState('2026-01-01')).toEqual({ routineId: null, isRest: true });
    expect(builder.select).toHaveBeenCalledWith('routine_id, is_rest');
    expect(await getDailyOverride('2026-01-01')).toBeNull();
  });

  it('falls back to the cached rest state when the fetch fails', async () => {
    mockSupabase.from.mockReturnValueOnce(makeBuilder({ data: { routine_id: null, is_rest: true }, error: null }));
    await getDailyOverrideState('2026-01-01');

    mockSupabase.from.mockReturnValueOnce(makeBuilder({ data: null, error: { message: 'boom' }, status: 0 }));
    expect(await getDailyOverrideState('2026-01-01')).toEqual({ routineId: null, isRest: true });
    expect(emitError).not.toHaveBeenCalled();
  });

  it('reads an old cache entry without isRest as not rest', async () => {
    localStorage.setItem('onyx_daily_override_cache_2026-01-01', JSON.stringify({ value: 'r1' }));
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: { message: 'boom' }, status: 0 }));

    expect(await getDailyOverrideState('2026-01-01')).toEqual({ routineId: 'r1', isRest: false });
  });
});

describe('getDailyViewBundle', () => {
  const makeSequentialBuilder = (results: { data: unknown; error: unknown }[]) => {
    let call = 0;
    mockSupabase.from.mockImplementation(() => makeBuilder(results[Math.min(call++, results.length - 1)]));
  };

  it('bundles all four reads and caches the bundle on full success', async () => {
    makeSequentialBuilder([
      { data: [{ id: 'w1', date: '2026-01-01', weight: 180 }], error: null }, // body_weights
      { data: [{ id: 'c1', date: '2026-01-01', type: 'Run', duration: 20 }], error: null }, // cardio_logs
      { data: [{ id: 'l1', date: '2026-01-01', sets: [] }], error: null }, // workout_logs
      { data: [{ id: 'm1', date: '2026-01-01', body_part: 'Navel', measurement: 32 }], error: null }, // circumferences
    ]);

    const bundle = await getDailyViewBundle('2026-01-01');

    expect(bundle.weights).toEqual([{ id: 'w1', date: '2026-01-01', weight: 180 }]);
    expect(bundle.cardioLogs).toEqual([{ id: 'c1', date: '2026-01-01', type: 'Run', duration: 20 }]);
    expect(bundle.logs).toEqual([{ id: 'l1', date: '2026-01-01', sets: [] }]);
    expect(bundle.measurements).toEqual([{ id: 'm1', date: '2026-01-01', body_part: 'Navel', measurement: 32 }]);
    expect(JSON.parse(localStorage.getItem('onyx_daily_view_cache_2026-01-01') ?? 'null')).toEqual(bundle);
  });

  it('falls back to the cached bundle for that date when any of the four reads fails, without a toast', async () => {
    localStorage.setItem('onyx_daily_view_cache_2026-01-01', JSON.stringify({
      weights: [{ id: 'w1', date: '2026-01-01', weight: 180 }],
      cardioLogs: [],
      logs: [],
      measurements: [],
    }));
    // All four reject (a real offline scenario would fail all of them
    // together) — status: 0 isn't required here since getDailyViewBundle
    // only cares *that* a read rejected, not why.
    mockSupabase.from.mockReturnValue(makeBuilder({ data: null, error: { message: 'offline' }, status: 0 }));

    const bundle = await getDailyViewBundle('2026-01-01');

    expect(bundle.weights).toEqual([{ id: 'w1', date: '2026-01-01', weight: 180 }]);
    expect(emitError).not.toHaveBeenCalled();
  });

  it('merges fresh successes over the cached fallback field-by-field, rather than discarding them when a sibling read fails', async () => {
    localStorage.setItem('onyx_daily_view_cache_2026-01-01', JSON.stringify({
      weights: [{ id: 'w1-stale', date: '2026-01-01', weight: 999 }],
      cardioLogs: [{ id: 'c1-stale', date: '2026-01-01', type: 'Run', duration: 1 }],
      logs: [{ id: 'l1-stale', date: '2026-01-01', sets: [] }],
      measurements: [{ id: 'm1-stale', date: '2026-01-01', body_part: 'Navel', measurement: 1 }],
    }));
    makeSequentialBuilder([
      { data: [{ id: 'w1-fresh', date: '2026-01-01', weight: 180 }], error: null }, // body_weights succeeds
      { data: [{ id: 'c1-fresh', date: '2026-01-01', type: 'Run', duration: 20 }], error: null }, // cardio_logs succeeds
      { data: null, error: { message: 'boom' } }, // workout_logs fails
      { data: null, error: { message: 'boom' } }, // circumferences fails
    ]);

    const bundle = await getDailyViewBundle('2026-01-01');

    // The two reads that succeeded this call use the fresh data, not the
    // stale cache, even though the overall call is in the "some read
    // failed" branch.
    expect(bundle.weights).toEqual([{ id: 'w1-fresh', date: '2026-01-01', weight: 180 }]);
    expect(bundle.cardioLogs).toEqual([{ id: 'c1-fresh', date: '2026-01-01', type: 'Run', duration: 20 }]);
    // The two that failed fall back to the cache instead of [].
    expect(bundle.logs).toEqual([{ id: 'l1-stale', date: '2026-01-01', sets: [] }]);
    expect(bundle.measurements).toEqual([{ id: 'm1-stale', date: '2026-01-01', body_part: 'Navel', measurement: 1 }]);
    // A cache exists, so this isn't a hard "nothing to show" failure.
    expect(emitError).not.toHaveBeenCalled();
  });

  it('falls back to a partial bundle (whichever reads succeeded) and surfaces a toast when there is no cache yet', async () => {
    makeSequentialBuilder([
      { data: [{ id: 'w1', date: '2026-01-01', weight: 180 }], error: null }, // body_weights succeeds
      { data: null, error: { message: 'boom' } }, // cardio_logs fails
      { data: null, error: { message: 'boom' } }, // workout_logs fails
      { data: null, error: { message: 'boom' } }, // circumferences fails
    ]);

    const bundle = await getDailyViewBundle('2026-01-01');

    expect(bundle.weights).toEqual([{ id: 'w1', date: '2026-01-01', weight: 180 }]);
    expect(bundle.cardioLogs).toEqual([]);
    expect(bundle.logs).toEqual([]);
    expect(bundle.measurements).toEqual([]);
    expect(emitError).toHaveBeenCalledWith("Could not load today's view.");
    // A failed load shouldn't clobber a previously-cached good bundle with
    // this partial one.
    expect(localStorage.getItem('onyx_daily_view_cache_2026-01-01')).toBeNull();
  });
});

describe('getUserSettings', () => {
  it('returns null without querying when there is no authenticated user, even via the getSession() fallback', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });

    const result = await getUserSettings();

    expect(result).toBeNull();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('falls back to the session user id when auth.getUser() resolves null (offline) rather than treating it as logged out', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockSupabase.from.mockReturnValue(
      makeBuilder({ data: { weight_unit: 'kg' }, error: null })
    );

    const result = await getUserSettings();

    expect(result).toEqual({ weight_unit: 'kg' });
    expect(mockSupabase.from).toHaveBeenCalledWith('user_settings');
  });

  it('returns null for a genuine "no settings row" result (PGRST116) — the real signal to insert defaults', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockSupabase.from.mockReturnValue(
      makeBuilder({ data: null, error: { code: 'PGRST116', message: 'no rows' } })
    );

    const result = await getUserSettings();

    expect(result).toBeNull();
  });

  it('throws without emitting an error toast on a network failure (offline), so callers can tell it apart from "no settings row yet" without spamming a toast', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockSupabase.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: 'TypeError: Failed to fetch' }, status: 0 })
    );

    await expect(getUserSettings()).rejects.toBeTruthy();
    expect(emitError).not.toHaveBeenCalled();
  });

  it('throws and emits an error toast on a genuine (non-network) server-side failure', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockSupabase.from.mockReturnValue(
      makeBuilder({ data: null, error: { code: '42501', message: 'permission denied' }, status: 403 })
    );

    await expect(getUserSettings()).rejects.toBeTruthy();
    expect(emitError).toHaveBeenCalledWith('Could not load settings.');
  });
});

describe('updateUserSettings', () => {
  it('queues the write when offline, using the getUser()-with-getSession()-fallback user id', async () => {
    // auth.getUser() revalidates over the network and resolves user: null
    // while offline (see the getUser() helper's comment in dataManager.ts) —
    // this is what previously made updateUserSettings silently drop offline
    // writes instead of routing them through performWrite/getUser().
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockSupabase.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: 'TypeError: Failed to fetch' }, status: 0 })
    );

    await updateUserSettings({ weight_unit: 'kg' });

    expect(enqueueWrite).toHaveBeenCalledWith('updateUserSettings', [{ weight_unit: 'kg' }, 'user-1']);
    expect(emitInfo).toHaveBeenCalledWith('Saved offline — will sync automatically when back online.');
  });

  it('does nothing when there is no authenticated user (online or offline)', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });

    await updateUserSettings({ weight_unit: 'kg' });

    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(enqueueWrite).not.toHaveBeenCalled();
  });

  it('saves normally when online', async () => {
    const builder = makeBuilder({ data: null, error: null, status: 200 });
    mockSupabase.from.mockReturnValue(builder);

    await updateUserSettings({ weight_unit: 'kg' });

    expect(mockSupabase.from).toHaveBeenCalledWith('user_settings');
    expect(builder.upsert).toHaveBeenCalledWith({ user_id: 'user-1', weight_unit: 'kg' });
    expect(enqueueWrite).not.toHaveBeenCalled();
  });
});
