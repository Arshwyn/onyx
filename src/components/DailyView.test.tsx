import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import DailyView from './DailyView';
import { emitError } from '../lib/toastBus';
import {
  getRoutines as _getRoutines, getExercises as _getExercises, getExerciseStats as _getExerciseStats,
  getDailyViewBundle as _getDailyViewBundle, addLog as _addLog, deleteLog as _deleteLog,
  getCardioLogsByDate as _getCardioLogsByDate,
  addCardioLog as _addCardioLog, deleteCardioLog as _deleteCardioLog,
  getCircumferencesByDate as _getCircumferencesByDate, addCircumference as _addCircumference,
  deleteCircumference as _deleteCircumference, getDailyOverrideState as _getDailyOverrideState,
  setDailyRest as _setDailyRest, removeDailyOverride as _removeDailyOverride, setDailyOverride as _setDailyOverride,
  getLastSessionSets as _getLastSessionSets,
} from '../dataManager';

// The mocked module (see vi.mock below) replaces every export with a bare
// vi.fn(), so tests interact with them through vi.mocked() rather than the
// real dataManager function types.
const getRoutines = vi.mocked(_getRoutines);
const getExercises = vi.mocked(_getExercises);
const getExerciseStats = vi.mocked(_getExerciseStats);
const getDailyViewBundle = vi.mocked(_getDailyViewBundle);
const addLog = vi.mocked(_addLog);
const deleteLog = vi.mocked(_deleteLog);
const getCardioLogsByDate = vi.mocked(_getCardioLogsByDate);
const addCardioLog = vi.mocked(_addCardioLog);
const deleteCardioLog = vi.mocked(_deleteCardioLog);
const getCircumferencesByDate = vi.mocked(_getCircumferencesByDate);
const addCircumference = vi.mocked(_addCircumference);
const deleteCircumference = vi.mocked(_deleteCircumference);
const getDailyOverrideState = vi.mocked(_getDailyOverrideState);
const setDailyRest = vi.mocked(_setDailyRest);
const removeDailyOverride = vi.mocked(_removeDailyOverride);
const setDailyOverride = vi.mocked(_setDailyOverride);
const getLastSessionSets = vi.mocked(_getLastSessionSets);

// DailyView drives everything off dataManager, so the component is exercised
// against a fully mocked data layer rather than a real Supabase client.
// Note: getDailyViewBundle is the *only* source of initial-load data for
// weights/cardio/logs/measurements (see dataManager.ts) — getCardioLogsByDate
// and getCircumferencesByDate are still imported/mocked separately here
// because DailyView also calls them directly, post-write, in
// handleCompletePlannedCardio/handleDeleteCardio/handleSaveMeasurement/
// handleDeleteMeasurement (see the "offline refetch failure" tests below).
vi.mock('../dataManager', () => ({
  getRoutines: vi.fn(),
  getExercises: vi.fn(),
  addLog: vi.fn(),
  updateLog: vi.fn(),
  deleteLog: vi.fn(),
  getExerciseStats: vi.fn(),
  getDailyViewBundle: vi.fn(),
  getCardioLogsByDate: vi.fn(),
  addBodyWeight: vi.fn(),
  getCardioLogs: vi.fn(),
  addCardioLog: vi.fn(),
  deleteCardioLog: vi.fn(),
  getCircumferencesByDate: vi.fn(),
  addCircumference: vi.fn(),
  deleteCircumference: vi.fn(),
  getDailyOverrideState: vi.fn(),
  setDailyRest: vi.fn(),
  setDailyOverride: vi.fn(),
  removeDailyOverride: vi.fn(),
  getLastSessionSets: vi.fn(),
}));

// Toast itself is mounted in App.tsx, not DailyView, so rendering DailyView
// alone can't assert on rendered toast text — mock toastBus and assert on
// the emitError call instead (same convention as dataManager.test.ts).
vi.mock('../lib/toastBus', () => ({
  emitError: vi.fn(),
  emitInfo: vi.fn(),
}));

// canvas-confetti reaches for a 2D canvas context, which jsdom doesn't back
// by default -- the library itself tolerates that (see its internal
// try/catch around getContext), but mocking it out avoids depending on that
// undocumented tolerance for the PR-badge tests below, which are the only
// ones that actually trigger the confetti branch in handleLogExercise.
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const ROUTINE = {
  id: 'r1',
  days: ['Monday'],
  name: 'Push Day',
  cardio: [],
  exercises: [
    { id: '1', sets: 3, reps: 10 },
    { id: '2', sets: 3, reps: 8 },
  ],
};

const EXERCISES = [
  { id: '1', name: 'Bench Press', category: 'Chest' },
  { id: '2', name: 'Overhead Press', category: 'Shoulders' },
];

const originalOnLine = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');
const setOnline = (value: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });
};

afterEach(() => {
  if (originalOnLine) Object.defineProperty(window.navigator, 'onLine', originalOnLine);
});

const emptyBundle = { weights: [], cardioLogs: [], logs: [], measurements: [] };

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  setOnline(true);

  getRoutines.mockResolvedValue([ROUTINE]);
  getExercises.mockResolvedValue(EXERCISES);
  // Override bypasses day-of-week matching so the test doesn't depend on
  // which day "today" actually is when the suite runs.
  getDailyOverrideState.mockResolvedValue({ routineId: 'r1', isRest: false, readFailed: false });
  setDailyRest.mockResolvedValue(true);
  removeDailyOverride.mockResolvedValue(true);
  setDailyOverride.mockResolvedValue(undefined);
  getDailyViewBundle.mockResolvedValue(emptyBundle);
  getLastSessionSets.mockResolvedValue({});
});

describe('DailyView exercise stats wiring', () => {
  it('scopes getExerciseStats to the routine\'s exercise ids and applies each row to the matching exercise only', async () => {
    getExerciseStats.mockResolvedValue([
      { exercise_id: '1', pr_weight: 225, last_date: '2026-01-01', last_weight: 200, last_reps: 5 },
      // exercise '2' intentionally has no row — never logged before
    ]);

    render(<DailyView />);

    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    // Scoped to exactly this routine's exercise ids, not the whole exercise library
    expect(getExerciseStats).toHaveBeenCalledWith(['1', '2'], expect.any(String));

    const benchCard = screen.getByText('Bench Press').closest('.border') as HTMLElement;
    const pressCard = screen.getByText('Overhead Press').closest('.border') as HTMLElement;

    // Bench Press has a stats row -> Last tag + inputs auto-populated from it
    expect(within(benchCard).getByText('Last: 200 lbs x 5')).toBeInTheDocument();
    const benchInputs = within(benchCard).getAllByRole('spinbutton');
    expect(benchInputs.map((i) => (i as HTMLInputElement).value)).toEqual(['200', '5', '200', '5', '200', '5']);

    // Overhead Press has no stats row -> no Last tag, inputs fall back to blank weight / routine's target reps
    expect(within(pressCard).queryByText(/^Last:/)).not.toBeInTheDocument();
    const pressInputs = within(pressCard).getAllByRole('spinbutton');
    expect(pressInputs.map((i) => (i as HTMLInputElement).value)).toEqual(['', '8', '', '8', '', '8']);
  });

  it('renders with no PR/last-session tags when getExerciseStats returns no rows at all', async () => {
    getExerciseStats.mockResolvedValue([]);

    render(<DailyView />);

    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    expect(getExerciseStats).toHaveBeenCalledWith(['1', '2'], expect.any(String));
    expect(screen.queryByText(/^Last:/)).not.toBeInTheDocument();
  });
});

describe('DailyView complete exercise flow', () => {
  it('logs a set without an unhandled rejection (regression: handleLogExercise called a nonexistent loadHistoryStats)', async () => {
    getExerciseStats.mockResolvedValue([
      { exercise_id: '1', pr_weight: 225, last_date: '2026-01-01', last_weight: 200, last_reps: 5 },
    ]);
    addLog.mockResolvedValue([]);

    render(<DailyView />);

    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    // handleLogExercise's onClick isn't awaited by React, so a throw inside it after the
    // addLog/loadDailyView calls surfaces as an unhandled rejection rather than a thrown
    // error fireEvent.click or an assertion would catch directly — listen for it explicitly.
    // eslint-config here only declares browser globals, so reach `process` via
    // globalThis rather than adding a node global for this one test.
    const nodeProcess = globalThis.process;
    const rejections: unknown[] = [];
    const onUnhandledRejection = (err) => rejections.push(err);
    nodeProcess.on('unhandledRejection', onUnhandledRejection);

    try {
      const benchCard = screen.getByText('Bench Press').closest('.border') as HTMLElement;
      fireEvent.click(within(benchCard).getByText('Complete Exercise'));

      await waitFor(() => expect(addLog).toHaveBeenCalledWith(
        expect.any(String), '1', expect.arrayContaining([expect.objectContaining({ weight: 200 })]),
      ));
      // Let any promise rejection from the (un-awaited) click handler's continuation surface.
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(rejections).toEqual([]);
    } finally {
      nodeProcess.off('unhandledRejection', onUnhandledRejection);
    }
  });

  it('keeps an exercise marked done after logging it offline, instead of the reload clobbering it back to not-done', async () => {
    // Regression: getDailyViewBundle (see dataManager.ts) falls back to its
    // cache instead of throwing, so loadDailyView's unconditional post-write
    // reload used to succeed "silently" offline and re-derive completedIds
    // from the stale cached logs — undoing the optimistic setCompletedIds
    // above it, with no error shown. Before getDailyViewBundle existed,
    // getLogsByDate threw here and loadDailyView's catch block bailed out
    // before ever reaching that re-derivation.
    setOnline(false);
    getExerciseStats.mockResolvedValue([
      { exercise_id: '1', pr_weight: 225, last_date: '2026-01-01', last_weight: 200, last_reps: 5 },
    ]);
    addLog.mockResolvedValue([]);

    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    const benchCard = screen.getByText('Bench Press').closest('.border') as HTMLElement;
    fireEvent.click(within(benchCard).getByText('Complete Exercise'));

    await waitFor(() => expect(addLog).toHaveBeenCalled());

    // addLog resolved (queued, see dataManager.ts's performWrite) even
    // though we're offline — the "Done" badge should stick rather than
    // being reverted by a reload that can't confirm the write yet.
    await waitFor(() => expect(within(benchCard).getByText('DONE')).toBeInTheDocument());
  });

  it('keeps an exercise marked skipped after skipping it offline, instead of the reload clobbering it back', async () => {
    setOnline(false);
    getExerciseStats.mockResolvedValue([]);
    addLog.mockResolvedValue([]);

    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    const benchCard = screen.getByText('Bench Press').closest('.border') as HTMLElement;
    fireEvent.click(within(benchCard).getByText('Skip'));

    await waitFor(() => expect(addLog).toHaveBeenCalledWith(
      expect.any(String), '1', expect.arrayContaining([expect.objectContaining({ isSkipped: true })]),
    ));

    await waitFor(() => expect(within(benchCard).getByText('SKIPPED')).toBeInTheDocument());
  });

  it('keeps the PR badge alongside Done even after the post-log stats refetch updates personalRecords to include the set just saved (regression: PR badge silently flipped to a plain Done)', async () => {
    // First call is the initial load (prior PR is 225); second call is
    // loadDailyView's post-log reload, whose get_exercise_stats now reflects
    // the 230 we're about to log as the new pr_weight -- exactly the
    // condition that used to make the old `maxLifted > prevMax` comparison
    // go false right after logging, since both sides would then read 230.
    getExerciseStats
      .mockResolvedValueOnce([
        { exercise_id: '1', pr_weight: 225, last_date: '2026-01-01', last_weight: 200, last_reps: 5 },
      ])
      .mockResolvedValueOnce([
        { exercise_id: '1', pr_weight: 230, last_date: '2026-01-01', last_weight: 230, last_reps: 5 },
      ]);
    // The post-log reload (loadDailyView) also re-fetches the bundle -- it
    // needs to reflect the just-saved log too, otherwise the reload's
    // re-derived completedIds would clobber the optimistic "done" state
    // back to pending regardless of the PR-badge logic under test here.
    getDailyViewBundle
      .mockResolvedValueOnce(emptyBundle)
      .mockResolvedValueOnce({
        ...emptyBundle,
        logs: [{ id: 'log1', exercise_id: '1', date: '2026-01-01', sets: [{ weight: 230, reps: 5 }] }],
      });
    addLog.mockResolvedValue([]);

    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    const benchCard = screen.getByText('Bench Press').closest('.border') as HTMLElement;
    const weightInput = within(benchCard).getAllByRole('spinbutton')[0] as HTMLInputElement;
    fireEvent.change(weightInput, { target: { value: '230' } });
    fireEvent.click(within(benchCard).getByText('Complete Exercise'));

    await waitFor(() => expect(addLog).toHaveBeenCalled());
    // Wait for the post-log reload's stats refetch (the second mocked call)
    // to actually land before asserting -- that's the moment the old bug fired.
    await waitFor(() => expect(getExerciseStats).toHaveBeenCalledTimes(2));

    expect(await within(benchCard).findByText('DONE')).toBeInTheDocument();
    expect(within(benchCard).getByText('🏆 PR')).toBeInTheDocument();
  });
});

describe('DailyView closed card actions', () => {
  it('shows only a single Reopen action for a completed exercise, not the pending edit controls', async () => {
    getExerciseStats.mockResolvedValue([]);
    getDailyViewBundle.mockResolvedValue({
      ...emptyBundle,
      logs: [{ id: 'log1', exercise_id: '1', date: '2026-01-01', sets: [{ weight: 200, reps: 5 }] }],
    });

    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    const benchCard = screen.getByText('Bench Press').closest('.border') as HTMLElement;
    fireEvent.click(within(benchCard).getByText('Bench Press'));

    expect(await within(benchCard).findByText('Reopen')).toBeInTheDocument();
    expect(within(benchCard).queryByText('Skip')).not.toBeInTheDocument();
    expect(within(benchCard).queryByText('Complete Exercise')).not.toBeInTheDocument();
    expect(within(benchCard).queryByText('Update Log')).not.toBeInTheDocument();
    expect(within(benchCard).queryByText('+ Set')).not.toBeInTheDocument();
    expect(within(benchCard).queryByText('Calc Plates')).not.toBeInTheDocument();
  });

  it('shows only a single Un-Skip action for a skipped exercise, not the pending edit controls', async () => {
    getExerciseStats.mockResolvedValue([]);
    getDailyViewBundle.mockResolvedValue({
      ...emptyBundle,
      logs: [{ id: 'log1', exercise_id: '1', date: '2026-01-01', sets: [{ isSkipped: true }] }],
    });

    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    const benchCard = screen.getByText('Bench Press').closest('.border') as HTMLElement;
    fireEvent.click(within(benchCard).getByText('Bench Press'));

    expect(await within(benchCard).findByText('Un-Skip')).toBeInTheDocument();
    expect(within(benchCard).queryByText('Complete Exercise')).not.toBeInTheDocument();
    expect(within(benchCard).queryByText('Reopen')).not.toBeInTheDocument();
    expect(within(benchCard).queryByText('+ Set')).not.toBeInTheDocument();
    expect(within(benchCard).queryByText('Calc Plates')).not.toBeInTheDocument();
  });
});

describe('DailyView cardio flow (offline refetch failure)', () => {
  it('optimistically removes a cardio entry when offline, instead of leaving the (queued-for-deletion) entry visible', async () => {
    setOnline(false);
    const existingLog = { id: 'c1', date: '2026-01-01', type: 'Run', duration: 20, distance: null };
    getDailyViewBundle.mockResolvedValue({ ...emptyBundle, cardioLogs: [existingLog] });
    deleteCardioLog.mockResolvedValue([]);

    render(<DailyView />);

    await waitFor(() => expect(screen.getByText('Run')).toBeInTheDocument());

    fireEvent.click(screen.getByText('✕'));
    fireEvent.click(await screen.findByText('Confirm'));

    await waitFor(() => expect(deleteCardioLog).toHaveBeenCalledWith('c1'));

    // deleteCardioLog resolved (the write is safely queued, see
    // dataManager.ts's performWrite) even though we're offline, so the
    // deleted entry should disappear immediately rather than linger because
    // a network read couldn't confirm it.
    await waitFor(() => expect(screen.queryByText('Run')).not.toBeInTheDocument());
  });

  it('optimistically marks a planned cardio session as done when offline', async () => {
    setOnline(false);
    const routineWithCardio = { ...ROUTINE, cardio: [{ id: 'pc1', type: 'Cycle', duration: 30 }] };
    getRoutines.mockResolvedValue([routineWithCardio]);
    addCardioLog.mockResolvedValue([]);

    render(<DailyView />);

    const cycleRow = await screen.findByText('Cycle').then((el) => el.closest('.border') as HTMLElement);
    fireEvent.click(within(cycleRow).getByText('Log'));

    await waitFor(() => expect(addCardioLog).toHaveBeenCalledWith(expect.any(String), 'Cycle', 30, null));

    // addCardioLog resolved (queued) even though we're offline, so the
    // planned item should flip to "done" immediately rather than staying
    // "Log" because a network read couldn't confirm it.
    await waitFor(() => expect(within(cycleRow).queryByText('Log')).not.toBeInTheDocument());
    expect(within(cycleRow).getByText('Done', { exact: false })).toBeInTheDocument();
  });

  it('surfaces the normal error toast (no optimistic fallback) when a post-log refetch fails while genuinely online', async () => {
    // Regression: this used to be a blind try/catch that treated *any*
    // refetch failure as "must be offline" and fabricated an optimistic
    // entry with a fake id — silently, with no error toast — even for a
    // real online failure (a flaky request, a transient 5xx) where nothing
    // was actually queued and 'onyx-sync-complete' would never fire to
    // reconcile it.
    const routineWithCardio = { ...ROUTINE, cardio: [{ id: 'pc1', type: 'Cycle', duration: 30 }] };
    getRoutines.mockResolvedValue([routineWithCardio]);
    getCardioLogsByDate.mockRejectedValue(new Error('transient 500'));
    addCardioLog.mockResolvedValue([]);

    render(<DailyView />);

    const cycleRow = await screen.findByText('Cycle').then((el) => el.closest('.border') as HTMLElement);
    fireEvent.click(within(cycleRow).getByText('Log'));

    await waitFor(() => expect(addCardioLog).toHaveBeenCalledWith(expect.any(String), 'Cycle', 30, null));
    await waitFor(() => expect(getCardioLogsByDate).toHaveBeenCalledTimes(1));

    // Still shows "Log" (not optimistically flipped to "Done") and the
    // failure is surfaced rather than silently fabricated.
    expect(within(cycleRow).getByText('Log')).toBeInTheDocument();
    expect(emitError).toHaveBeenCalledWith('Saved, but could not refresh cardio logs.');
  });
});

describe('DailyView measurement flow (offline refetch failure)', () => {
  it('optimistically adds a measurement when offline, instead of leaving it invisible', async () => {
    setOnline(false);
    getExerciseStats.mockResolvedValue([]);
    addCircumference.mockResolvedValue([]);

    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    const section = screen.getByText('Add Measurement').closest('div') as HTMLElement;
    fireEvent.change(within(section).getByRole('spinbutton'), { target: { value: '15.5' } });
    fireEvent.click(within(section).getByText('Log'));

    await waitFor(() => expect(addCircumference).toHaveBeenCalledWith(expect.any(String), 'Navel', '15.5'));

    // addCircumference resolved (queued, see dataManager.ts's performWrite)
    // even though we're offline, so the new entry should appear immediately
    // rather than staying invisible because a network read couldn't confirm
    // it.
    await waitFor(() => expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === '15.5 in')).toBeInTheDocument());
  });

  it('optimistically removes a measurement when offline, instead of leaving it visible', async () => {
    setOnline(false);
    getExerciseStats.mockResolvedValue([]);
    const existingMeasurement = { id: 'm1', date: '2026-01-01', body_part: 'Navel', measurement: 32 };
    getDailyViewBundle.mockResolvedValue({ ...emptyBundle, measurements: [existingMeasurement] });
    deleteCircumference.mockResolvedValue(undefined);

    render(<DailyView />);
    const measurementRow = await screen.findByText((_, el) => el?.tagName === 'SPAN' && el.textContent === '32 in')
      .then((el) => el.closest('.border') as HTMLElement);

    fireEvent.click(within(measurementRow).getByText('✕'));
    fireEvent.click(await screen.findByText('Confirm'));

    await waitFor(() => expect(deleteCircumference).toHaveBeenCalledWith('m1'));

    // deleteCircumference resolved (queued) even though we're offline, so
    // the deleted entry should disappear immediately rather than linger
    // because a network read couldn't confirm it.
    await waitFor(() => expect(measurementRow).not.toBeInTheDocument());
  });

  it('surfaces the normal error toast (no optimistic fallback) when a post-save refetch fails while genuinely online', async () => {
    getExerciseStats.mockResolvedValue([]);
    getCircumferencesByDate.mockRejectedValue(new Error('transient 500'));
    addCircumference.mockResolvedValue([]);

    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    const section = screen.getByText('Add Measurement').closest('div') as HTMLElement;
    fireEvent.change(within(section).getByRole('spinbutton'), { target: { value: '15.5' } });
    fireEvent.click(within(section).getByText('Log'));

    await waitFor(() => expect(addCircumference).toHaveBeenCalledWith(expect.any(String), 'Navel', '15.5'));
    await waitFor(() => expect(getCircumferencesByDate).toHaveBeenCalledTimes(1));

    // No optimistic entry fabricated — the failure is surfaced instead.
    expect(screen.queryByText((_, el) => el?.tagName === 'SPAN' && el.textContent === '15.5 in')).not.toBeInTheDocument();
    expect(emitError).toHaveBeenCalledWith('Saved, but could not refresh measurements.');
  });
});

describe('DailyView progression suggestions', () => {
  const lastSession = (sets) => ({ '1': { date: '2026-01-01', sets } });

  it('feature off (default): no badge, and prefill is byte-identical to the pre-progression fallback', async () => {
    // onyx_progression_enabled is intentionally left unset -- default-off,
    // per the opposite-of-every-other-toggle convention from PR #31.
    getExerciseStats.mockResolvedValue([
      { exercise_id: '1', pr_weight: 225, last_date: '2026-01-01', last_weight: 200, last_reps: 10 },
    ]);
    getLastSessionSets.mockResolvedValue(lastSession([
      { weight: 200, reps: 10 }, { weight: 200, reps: 10 }, { weight: 200, reps: 10 },
    ]));

    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    const benchCard = screen.getByText('Bench Press').closest('.border') as HTMLElement;
    expect(within(benchCard).queryByText('+ REPS')).not.toBeInTheDocument();
    expect(within(benchCard).queryByText(/^↑/)).not.toBeInTheDocument();
    const benchInputs = within(benchCard).getAllByRole('spinbutton');
    expect(benchInputs.map((i) => (i as HTMLInputElement).value)).toEqual(['200', '10', '200', '10', '200', '10']);
  });

  it('feature off, with a mixed-weight last session (warm-up + work sets): prefill still comes from stats, not the higher topWeight', async () => {
    // Regression: suggest()'s DISABLED branch still computes weight as
    // topWeight(last.sets) -- the max across all sets -- which can differ
    // from getExerciseStats' own last_weight for a non-uniform session (a
    // warm-up set below the working weight). Disabling the feature must not
    // let that higher value leak into the prefill.
    getExerciseStats.mockResolvedValue([
      { exercise_id: '1', pr_weight: 225, last_date: '2026-01-01', last_weight: 135, last_reps: 8 },
    ]);
    getLastSessionSets.mockResolvedValue(lastSession([
      { weight: 135, reps: 8 }, { weight: 185, reps: 8 }, { weight: 185, reps: 8 },
    ]));

    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    const benchCard = screen.getByText('Bench Press').closest('.border') as HTMLElement;
    expect(within(benchCard).queryByText('+ REPS')).not.toBeInTheDocument();
    expect(within(benchCard).queryByText(/^↑/)).not.toBeInTheDocument();
    const benchInputs = within(benchCard).getAllByRole('spinbutton');
    // Stats-based last_weight/last_reps (135/8), not getLastSessionSets'
    // topWeight (185) that the DISABLED suggestion would otherwise carry.
    expect(benchInputs.map((i) => (i as HTMLInputElement).value)).toEqual(['135', '8', '135', '8', '135', '8']);
  });

  it('ADD_WEIGHT: shows the weight badge and prefills the stepped-up weight with reps at repMin', async () => {
    localStorage.setItem('onyx_progression_enabled', 'true');
    getExerciseStats.mockResolvedValue([]);
    // Fixed target (ROUTINE's exercise '1' is sets:3, reps:10, no repMax) --
    // hit 10 reps on every set at 200 lbs -> ADD_WEIGHT.
    getLastSessionSets.mockResolvedValue(lastSession([
      { weight: 200, reps: 10 }, { weight: 200, reps: 10 }, { weight: 200, reps: 10 },
    ]));

    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    const benchCard = screen.getByText('Bench Press').closest('.border') as HTMLElement;
    expect(within(benchCard).getByText('↑ 205 lbs')).toBeInTheDocument();
    const benchInputs = within(benchCard).getAllByRole('spinbutton');
    expect(benchInputs.map((i) => (i as HTMLInputElement).value)).toEqual(['205', '10', '205', '10', '205', '10']);
  });

  it('ADD_REPS: shows the reps badge and prefills unchanged weight with a non-uniform rep ladder', async () => {
    localStorage.setItem('onyx_progression_enabled', 'true');
    // Give exercise '1' a rep range (8-12) so there's room to climb within it.
    getRoutines.mockResolvedValue([{ ...ROUTINE, exercises: [{ id: '1', sets: 3, reps: 8, repMax: 12 }, { id: '2', sets: 3, reps: 8 }] }]);
    getExerciseStats.mockResolvedValue([]);
    getLastSessionSets.mockResolvedValue(lastSession([
      { weight: 185, reps: 12 }, { weight: 185, reps: 11 }, { weight: 185, reps: 9 },
    ]));

    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    const benchCard = screen.getByText('Bench Press').closest('.border') as HTMLElement;
    expect(within(benchCard).getByText('+ REPS')).toBeInTheDocument();
    const benchInputs = within(benchCard).getAllByRole('spinbutton');
    // Weight unchanged (185 on every set), reps climb per-set: 12, 12, 10 --
    // not the uniform fill today's behavior would have produced.
    expect(benchInputs.map((i) => (i as HTMLInputElement).value)).toEqual(['185', '12', '185', '12', '185', '10']);
  });

  it('ADD_REPS: tapping the badge expands reasoning that frames the ladder as today\'s goal, not something to "beat"', async () => {
    localStorage.setItem('onyx_progression_enabled', 'true');
    getRoutines.mockResolvedValue([{ ...ROUTINE, exercises: [{ id: '1', sets: 3, reps: 8, repMax: 12 }, { id: '2', sets: 3, reps: 8 }] }]);
    getExerciseStats.mockResolvedValue([]);
    getLastSessionSets.mockResolvedValue(lastSession([
      { weight: 185, reps: 12 }, { weight: 185, reps: 11 }, { weight: 185, reps: 9 },
    ]));

    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    const benchCard = screen.getByText('Bench Press').closest('.border') as HTMLElement;
    fireEvent.click(within(benchCard).getByText('+ REPS'));

    expect(within(benchCard).getByText('1 of 3 sets at 12 reps last time — aim for 12, 12, 10 today')).toBeInTheDocument();
  });

  it('cascade: editing set 1 only propagates into later sets that still match the old value, preserving a rep ladder', async () => {
    localStorage.setItem('onyx_progression_enabled', 'true');
    getRoutines.mockResolvedValue([{ ...ROUTINE, exercises: [{ id: '1', sets: 3, reps: 8, repMax: 12 }, { id: '2', sets: 3, reps: 8 }] }]);
    getExerciseStats.mockResolvedValue([]);
    getLastSessionSets.mockResolvedValue(lastSession([
      { weight: 185, reps: 12 }, { weight: 185, reps: 11 }, { weight: 185, reps: 9 },
    ]));

    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    const benchCard = screen.getByText('Bench Press').closest('.border') as HTMLElement;
    const benchInputs = within(benchCard).getAllByRole('spinbutton');
    // Layout is [weight1, reps1, weight2, reps2, weight3, reps3]; reps start at 12, 12, 10.
    fireEvent.change(benchInputs[1], { target: { value: '13' } });

    // Set 2's reps (12) matched set 1's old value (12) so it cascades to 13;
    // set 3's reps (10) didn't match, so it's left alone.
    expect((benchInputs[1] as HTMLInputElement).value).toBe('13');
    expect((benchInputs[3] as HTMLInputElement).value).toBe('13');
    expect((benchInputs[5] as HTMLInputElement).value).toBe('10');
  });

  it('does not let a background reload clobber an in-progress edit', async () => {
    localStorage.setItem('onyx_progression_enabled', 'true');
    getExerciseStats.mockResolvedValue([]);
    getLastSessionSets.mockResolvedValue(lastSession([
      { weight: 200, reps: 10 }, { weight: 200, reps: 10 }, { weight: 200, reps: 10 },
    ]));

    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    const benchCard = screen.getByText('Bench Press').closest('.border') as HTMLElement;
    const benchInputs = within(benchCard).getAllByRole('spinbutton');
    fireEvent.change(benchInputs[0], { target: { value: '999' } });

    fireEvent(window, new Event('onyx-sync-complete'));
    await waitFor(() => expect(getExerciseStats).toHaveBeenCalledTimes(2));

    expect((benchInputs[0] as HTMLInputElement).value).toBe('999');
  });
});

describe('DailyView reopen exercise flow', () => {
  const bundleWithBenchLog = {
    ...emptyBundle,
    logs: [{ id: 'log1', exercise_id: '1', date: '2026-01-01', sets: [{ weight: 200, reps: 5 }] }],
  };

  it('does not delete anything until the confirmation is accepted', async () => {
    getExerciseStats.mockResolvedValue([]);
    getDailyViewBundle.mockResolvedValue(bundleWithBenchLog);

    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    // Bench Press starts already completed (existing log in the bundle) --
    // expand its collapsed card to reach the Reopen link.
    const benchCard = screen.getByText('Bench Press').closest('.border') as HTMLElement;
    expect(within(benchCard).getByText('DONE')).toBeInTheDocument();
    fireEvent.click(within(benchCard).getByText('Bench Press'));
    fireEvent.click(within(benchCard).getByText('Reopen'));

    expect(await screen.findByText('Reopen Exercise?')).toBeInTheDocument();
    expect(deleteLog).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Cancel'));

    expect(deleteLog).not.toHaveBeenCalled();
    expect(within(benchCard).getByText('DONE')).toBeInTheDocument();
  });

  it('reverts a completed exercise back to pending on confirm, deleting its log and keeping the entered numbers', async () => {
    // Offline, same reasoning as the complete/skip-offline tests above: the
    // static getDailyViewBundle mock still contains bundleWithBenchLog's log
    // after "deletion", so staying online would let the post-confirm
    // loadDailyView reload clobber the optimistic reopen back to done.
    setOnline(false);
    getExerciseStats.mockResolvedValue([]);
    getDailyViewBundle.mockResolvedValue(bundleWithBenchLog);
    deleteLog.mockResolvedValue(undefined);

    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    const benchCard = screen.getByText('Bench Press').closest('.border') as HTMLElement;
    fireEvent.click(within(benchCard).getByText('Bench Press'));
    fireEvent.click(within(benchCard).getByText('Reopen'));
    fireEvent.click(await screen.findByText('Confirm'));

    await waitFor(() => expect(deleteLog).toHaveBeenCalledWith('log1'));
    await waitFor(() => expect(within(benchCard).queryByText('DONE')).not.toBeInTheDocument());
    expect(within(benchCard).getByText('Complete Exercise')).toBeInTheDocument();

    // The previously-logged numbers stick around for editing rather than
    // going blank (setInputs is deliberately left untouched by
    // handleReopenExercise).
    const benchInputs = within(benchCard).getAllByRole('spinbutton');
    expect((benchInputs[0] as HTMLInputElement).value).toBe('200');
  });
});

describe('DailyView set editing (add/remove)', () => {
  it('auto-populates a newly added set from the previous set, not blank', async () => {
    getExerciseStats.mockResolvedValue([
      { exercise_id: '1', pr_weight: 225, last_date: '2026-01-01', last_weight: 200, last_reps: 5 },
    ]);

    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    // Bench Press starts with 3 sets pre-filled from stats (200 x 5 each --
    // see the "exercise stats wiring" describe block above).
    const benchCard = screen.getByText('Bench Press').closest('.border') as HTMLElement;
    fireEvent.click(within(benchCard).getByText('+ Set'));

    const inputs = within(benchCard).getAllByRole('spinbutton') as HTMLInputElement[];
    expect(inputs.map((i) => i.value)).toEqual(['200', '5', '200', '5', '200', '5', '200', '5']);
  });

  it('removes an empty set immediately, without a confirmation', async () => {
    getExerciseStats.mockResolvedValue([]);

    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    // A pending set's reps default to the routine's target reps even with
    // no history (see loadDailyView's fallback to ex.targetReps) -- clear
    // it out to get a genuinely empty set (no weight, no reps) rather than
    // relying on a state that's actually unreachable through normal use.
    const benchCard = screen.getByText('Bench Press').closest('.border') as HTMLElement;
    fireEvent.change(within(benchCard).getAllByPlaceholderText('reps')[0], { target: { value: '' } });

    const initialCount = within(benchCard).getAllByText('✕').length;
    fireEvent.click(within(benchCard).getAllByText('✕')[0]);

    expect(screen.queryByText('Remove Set?')).not.toBeInTheDocument();
    expect(within(benchCard).getAllByText('✕').length).toBe(initialCount - 1);
  });

  it('requires confirmation before removing a set that has data, and only removes it once confirmed', async () => {
    getExerciseStats.mockResolvedValue([
      { exercise_id: '1', pr_weight: 225, last_date: '2026-01-01', last_weight: 200, last_reps: 5 },
    ]);

    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    const benchCard = screen.getByText('Bench Press').closest('.border') as HTMLElement;
    const initialCount = within(benchCard).getAllByText('✕').length;

    fireEvent.click(within(benchCard).getAllByText('✕')[0]);

    expect(await screen.findByText('Remove Set?')).toBeInTheDocument();
    // Not removed yet -- still waiting on confirmation.
    expect(within(benchCard).getAllByText('✕').length).toBe(initialCount);

    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => expect(within(benchCard).getAllByText('✕').length).toBe(initialCount - 1));
  });

  it('does not remove a set with data when the confirmation is cancelled', async () => {
    getExerciseStats.mockResolvedValue([
      { exercise_id: '1', pr_weight: 225, last_date: '2026-01-01', last_weight: 200, last_reps: 5 },
    ]);

    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    const benchCard = screen.getByText('Bench Press').closest('.border') as HTMLElement;
    const initialCount = within(benchCard).getAllByText('✕').length;

    fireEvent.click(within(benchCard).getAllByText('✕')[0]);
    fireEvent.click(await screen.findByText('Cancel'));

    expect(within(benchCard).getAllByText('✕').length).toBe(initialCount);
  });
});

describe('DailyView database-backed rest days', () => {
  beforeEach(() => {
    getExerciseStats.mockResolvedValue([]);
  });

  it('shows Rest Day when the database marks the date as rest', async () => {
    getDailyOverrideState.mockResolvedValue({ routineId: null, isRest: true, readFailed: false });

    render(<DailyView />);

    expect(await screen.findByText('Rest Day')).toBeInTheDocument();
  });

  it('writes the rest marker through setDailyRest, not localStorage, when Rest is tapped', async () => {
    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Rest'));

    await waitFor(() => expect(setDailyRest).toHaveBeenCalledTimes(1));
    expect(setDailyRest).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(await screen.findByText('Rest Day')).toBeInTheDocument();
    expect(Object.keys(localStorage).some((k) => k.startsWith('onyx_rest_'))).toBe(false);
  });

  it('reverts the optimistic rest state when the write is not accepted', async () => {
    setDailyRest.mockResolvedValue(false);
    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Rest'));

    await waitFor(() => expect(setDailyRest).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Rest Day')).not.toBeInTheDocument());
  });

  it('clears the marker with removeDailyOverride on "No, I want to workout"', async () => {
    getDailyOverrideState.mockResolvedValue({ routineId: null, isRest: true, readFailed: false });
    render(<DailyView />);

    fireEvent.click(await screen.findByText('No, I want to workout'));

    await waitFor(() => expect(removeDailyOverride).toHaveBeenCalledTimes(1));
  });

  it('forces rest on the target date with setDailyRest when swapping with an empty today', async () => {
    // Viewing another day that has a routine; today has no routine.
    getRoutines.mockResolvedValue([{ ...ROUTINE, days: [] }]);
    getDailyOverrideState.mockImplementation(async () => ({ routineId: 'r1', isRest: false, readFailed: false }));
    render(<DailyView />);
    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Next day'));
    // Today's state: no override, no routine scheduled.
    getDailyOverrideState.mockImplementation(async (d: string) => (
      d === new Date().toLocaleDateString('en-CA') ? { routineId: null, isRest: false, readFailed: false } : { routineId: 'r1', isRest: false, readFailed: false }
    ));
    fireEvent.click(await screen.findByText('Do This Today'));
    fireEvent.click(await screen.findByText('Confirm'));

    await waitFor(() => expect(setDailyRest).toHaveBeenCalledTimes(1));
    expect(setDailyOverride).toHaveBeenCalledTimes(1);
  });

  it('migrates a legacy localStorage rest flag to the database and removes the key', async () => {
    getDailyOverrideState.mockResolvedValue({ routineId: null, isRest: false, readFailed: false });
    localStorage.setItem('onyx_rest_2026-01-05', 'true');

    render(<DailyView />);

    await waitFor(() => expect(setDailyRest).toHaveBeenCalledWith('2026-01-05'));
    await waitFor(() => expect(localStorage.getItem('onyx_rest_2026-01-05')).toBeNull());
  });

  it('keeps the database row and drops the legacy key when the date already has an override', async () => {
    getDailyOverrideState.mockResolvedValue({ routineId: 'r1', isRest: false, readFailed: false });
    localStorage.setItem('onyx_rest_2026-01-05', 'true');

    render(<DailyView />);

    await waitFor(() => expect(localStorage.getItem('onyx_rest_2026-01-05')).toBeNull());
    expect(setDailyRest).not.toHaveBeenCalled();
  });

  it('keeps the legacy key when the rest write is not accepted', async () => {
    getDailyOverrideState.mockResolvedValue({ routineId: null, isRest: false, readFailed: false });
    setDailyRest.mockResolvedValue(false);
    localStorage.setItem('onyx_rest_2026-01-05', 'true');

    render(<DailyView />);

    await waitFor(() => expect(setDailyRest).toHaveBeenCalled());
    expect(localStorage.getItem('onyx_rest_2026-01-05')).toBe('true');
  });
});
