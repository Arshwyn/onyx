import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TrendsView from './TrendsView';
import { emitError } from '../lib/toastBus';
import {
  getBodyWeights as _getBodyWeights, deleteBodyWeight as _deleteBodyWeight,
  getLogs as _getLogs, getExercises as _getExercises,
  getCircumferences as _getCircumferences, deleteCircumference as _deleteCircumference,
} from '../dataManager';

// The mocked module (see vi.mock below) replaces every export with a bare
// vi.fn(), so tests interact with them through vi.mocked() rather than the
// real dataManager function types.
const getBodyWeights = vi.mocked(_getBodyWeights);
const deleteBodyWeight = vi.mocked(_deleteBodyWeight);
const getLogs = vi.mocked(_getLogs);
const getExercises = vi.mocked(_getExercises);
const getCircumferences = vi.mocked(_getCircumferences);
const deleteCircumference = vi.mocked(_deleteCircumference);

// TrendsView drives everything off dataManager, so the component is
// exercised against a fully mocked data layer rather than a real Supabase
// client (same convention as DailyView.test.tsx).
vi.mock('../dataManager', () => ({
  getBodyWeights: vi.fn(),
  deleteBodyWeight: vi.fn(),
  getLogs: vi.fn(),
  getExercises: vi.fn(),
  getCircumferences: vi.fn(),
  deleteCircumference: vi.fn(),
}));

// Toast itself is mounted in App.tsx, not TrendsView — mock toastBus and
// assert on the emitError call instead (same convention as
// dataManager.test.ts/DailyView.test.tsx).
vi.mock('../lib/toastBus', () => ({
  emitError: vi.fn(),
  emitInfo: vi.fn(),
}));

const originalOnLine = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');
const setOnline = (value: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });
};

// TrendsView's default date range is "today minus 30 days" computed from the
// real clock, so fixture dates are computed the same way (local-time, not
// toISOString's UTC) rather than hardcoded -- otherwise these tests would
// start failing the moment "today" drifted more than 30 days past a
// hardcoded date.
const getLocalDateStr = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return getLocalDateStr(d);
};

beforeEach(() => {
  vi.resetAllMocks();
  setOnline(true);

  getBodyWeights.mockResolvedValue([]);
  getCircumferences.mockResolvedValue([]);
  getLogs.mockResolvedValue([]);
  getExercises.mockResolvedValue([]);
});

afterEach(() => {
  if (originalOnLine) Object.defineProperty(window.navigator, 'onLine', originalOnLine);
});

describe('TrendsView weight flow (delete + refetch failure)', () => {
  it('optimistically removes a weight entry when offline, instead of leaving it visible', async () => {
    setOnline(false);
    getBodyWeights.mockResolvedValueOnce([{ id: 'w1', date: daysAgo(5), weight: 180 }])
      .mockRejectedValueOnce(new Error('offline'));
    deleteBodyWeight.mockResolvedValue(undefined);

    render(<TrendsView />);
    fireEvent.click(await screen.findByText('Weight'));

    await waitFor(() => expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === '180 lbs')).toBeInTheDocument());

    fireEvent.click(screen.getByText('✕'));
    fireEvent.click(await screen.findByText('Confirm'));

    await waitFor(() => expect(deleteBodyWeight).toHaveBeenCalledWith('w1'));
    await waitFor(() => expect(screen.queryByText((_, el) => el?.tagName === 'SPAN' && el.textContent === '180 lbs')).not.toBeInTheDocument());
    expect(emitError).not.toHaveBeenCalled();
  });

  it('surfaces the normal error toast (existing data kept) when the post-delete refetch fails while genuinely online', async () => {
    // Regression guard for #23's fix: a failed refetch here — for *any*
    // reason — must not resolve to [] (getBodyWeights swallowing its own
    // error) and wipe bodyData entirely for a transient failure that had
    // nothing to do with being offline.
    getBodyWeights.mockResolvedValueOnce([{ id: 'w1', date: daysAgo(5), weight: 175 }])
      .mockRejectedValueOnce(new Error('transient 500'));
    deleteBodyWeight.mockResolvedValue(undefined);

    render(<TrendsView />);
    fireEvent.click(await screen.findByText('Weight'));
    await waitFor(() => expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === '175 lbs')).toBeInTheDocument());

    fireEvent.click(screen.getByText('✕'));
    fireEvent.click(await screen.findByText('Confirm'));

    await waitFor(() => expect(deleteBodyWeight).toHaveBeenCalledWith('w1'));
    await waitFor(() => expect(getBodyWeights).toHaveBeenCalledTimes(2));

    // Existing entry is still there (not wiped) since the failure was
    // surfaced instead of silently applying an unknown-outcome update.
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === '175 lbs')).toBeInTheDocument();
    expect(emitError).toHaveBeenCalledWith('Deleted, but could not refresh body weight history.');
  });
});

describe('TrendsView measurement flow (delete + refetch failure)', () => {
  it('optimistically removes a measurement when offline, instead of leaving it visible', async () => {
    setOnline(false);
    getCircumferences.mockResolvedValueOnce([{ id: 'm1', date: daysAgo(5), body_part: 'Navel', measurement: 32 }])
      .mockRejectedValueOnce(new Error('offline'));
    deleteCircumference.mockResolvedValue(undefined);

    render(<TrendsView />);
    fireEvent.click(await screen.findByText('Measure'));

    await waitFor(() => expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === '32 in')).toBeInTheDocument());

    fireEvent.click(screen.getByText('✕'));
    fireEvent.click(await screen.findByText('Confirm'));

    await waitFor(() => expect(deleteCircumference).toHaveBeenCalledWith('m1'));
    await waitFor(() => expect(screen.queryByText((_, el) => el?.tagName === 'SPAN' && el.textContent === '32 in')).not.toBeInTheDocument());
    expect(emitError).not.toHaveBeenCalled();
  });

  it('surfaces the normal error toast (existing data kept) when the post-delete refetch fails while genuinely online', async () => {
    getCircumferences.mockResolvedValueOnce([{ id: 'm1', date: daysAgo(5), body_part: 'Navel', measurement: 30 }])
      .mockRejectedValueOnce(new Error('transient 500'));
    deleteCircumference.mockResolvedValue(undefined);

    render(<TrendsView />);
    fireEvent.click(await screen.findByText('Measure'));
    await waitFor(() => expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === '30 in')).toBeInTheDocument());

    fireEvent.click(screen.getByText('✕'));
    fireEvent.click(await screen.findByText('Confirm'));

    await waitFor(() => expect(deleteCircumference).toHaveBeenCalledWith('m1'));
    await waitFor(() => expect(getCircumferences).toHaveBeenCalledTimes(2));

    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === '30 in')).toBeInTheDocument();
    expect(emitError).toHaveBeenCalledWith('Deleted, but could not refresh measurements.');
  });
});

describe('TrendsView onyx-sync-complete handling', () => {
  it('reloads all data when a background sync completes', async () => {
    render(<TrendsView />);
    await waitFor(() => expect(getBodyWeights).toHaveBeenCalledTimes(1));

    window.dispatchEvent(new Event('onyx-sync-complete'));

    await waitFor(() => expect(getBodyWeights).toHaveBeenCalledTimes(2));
  });

  it('surfaces an error toast (rather than crashing) if the initial load fails', async () => {
    getBodyWeights.mockRejectedValueOnce(new Error('boom'));

    render(<TrendsView />);

    await waitFor(() => expect(emitError).toHaveBeenCalledWith('Could not load trends data.'));
    expect(screen.getByText('Lifts')).toBeInTheDocument();
  });
});

describe('TrendsView exercise chart (no default lift, search to select)', () => {
  const EXERCISES = [{ id: 'e1', name: 'Bench Press' }, { id: 'e2', name: 'Squat' }];

  it('shows an empty state with no lift selected until the user searches', async () => {
    getExercises.mockResolvedValue(EXERCISES);
    getLogs.mockResolvedValue([
      { id: 'l1', date: daysAgo(21), exercise_id: 'e1', sets: [{ weight: '135', reps: '5' }] },
      { id: 'l2', date: daysAgo(14), exercise_id: 'e1', sets: [{ weight: '145', reps: '5' }] },
    ]);

    render(<TrendsView />);
    await waitFor(() => expect(screen.getByText('Lifts')).toBeInTheDocument());

    expect(screen.getByText('Search for a lift above to see its trend.')).toBeInTheDocument();
    expect(screen.queryByText(/^Showing:/)).not.toBeInTheDocument();
  });

  it('searches, selects an exercise via the pill results, and shows the gradient chart once there are 2+ points', async () => {
    getExercises.mockResolvedValue(EXERCISES);
    getLogs.mockResolvedValue([
      { id: 'l1', date: daysAgo(21), exercise_id: 'e1', sets: [{ weight: '135', reps: '5' }] },
      { id: 'l2', date: daysAgo(14), exercise_id: 'e1', sets: [{ weight: '145', reps: '5' }] },
    ]);

    render(<TrendsView />);
    await waitFor(() => expect(screen.getByText('Lifts')).toBeInTheDocument());

    const search = screen.getByPlaceholderText('Search exercise…');
    fireEvent.change(search, { target: { value: 'bench' } });
    fireEvent.click(await screen.findByText('Bench Press'));

    await waitFor(() => expect(screen.getByText('Showing: Bench Press')).toBeInTheDocument());
    expect(search).toHaveValue('');
    await waitFor(() => expect(screen.getByText('Progress (2 entries)')).toBeInTheDocument());
    expect(screen.getByText('▲ Up')).toBeInTheDocument();
    expect(screen.queryByText('Need at least 2 data points to show a trend.')).not.toBeInTheDocument();
  });

  it('shows the empty-chart state with fewer than 2 points', async () => {
    getExercises.mockResolvedValue(EXERCISES);
    getLogs.mockResolvedValue([
      { id: 'l1', date: daysAgo(10), exercise_id: 'e1', sets: [{ weight: '135', reps: '5' }] },
    ]);

    render(<TrendsView />);
    await waitFor(() => expect(screen.getByText('Lifts')).toBeInTheDocument());

    const search = screen.getByPlaceholderText('Search exercise…');
    fireEvent.change(search, { target: { value: 'bench' } });
    fireEvent.click(await screen.findByText('Bench Press'));

    await waitFor(() => expect(screen.getByText('Showing: Bench Press')).toBeInTheDocument());
    expect(screen.getByText('Need at least 2 data points to show a trend.')).toBeInTheDocument();
  });

  it('searches, selects an exercise via the pill results, and clears the query', async () => {
    getExercises.mockResolvedValue(EXERCISES);

    render(<TrendsView />);
    await waitFor(() => expect(screen.getByText('Lifts')).toBeInTheDocument());

    const search = screen.getByPlaceholderText('Search exercise…');
    fireEvent.change(search, { target: { value: 'squ' } });

    const option = await screen.findByText('Squat');
    fireEvent.click(option);

    await waitFor(() => expect(screen.getByText('Showing: Squat')).toBeInTheDocument());
    expect(search).toHaveValue('');
  });
});

describe('TrendsView measurements body-part chips (reskin)', () => {
  it('switches the filtered body part when a chip is clicked', async () => {
    getCircumferences.mockResolvedValue([{ id: 'm1', date: daysAgo(5), body_part: 'Navel', measurement: 32 }]);

    render(<TrendsView />);
    fireEvent.click(await screen.findByText('Measure'));

    expect(screen.getByText('Navel History')).toBeInTheDocument();
    expect(screen.queryByText('No records for Navel in this period.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Waist' }));

    expect(screen.getByText('Waist History')).toBeInTheDocument();
    expect(screen.getByText('No records for Waist in this period.')).toBeInTheDocument();
  });
});
