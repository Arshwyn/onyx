import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import HistoryView from './HistoryView';
import {
  getLogsRange as _getLogsRange, getCardioLogsRange as _getCardioLogsRange, getExercises as _getExercises,
  deleteLog as _deleteLog, deleteCardioLog as _deleteCardioLog,
  updateLog as _updateLog, updateCardioLog as _updateCardioLog,
  addLog as _addLog, addCardioLog as _addCardioLog,
} from '../dataManager';

// Same convention as WorkoutLogger.test.tsx/DailyView.test.tsx -- drive the
// component against a fully mocked data layer rather than a real Supabase client.
const getLogsRange = vi.mocked(_getLogsRange);
const getCardioLogsRange = vi.mocked(_getCardioLogsRange);
const getExercises = vi.mocked(_getExercises);
const deleteLog = vi.mocked(_deleteLog);
const deleteCardioLog = vi.mocked(_deleteCardioLog);
const updateLog = vi.mocked(_updateLog);
const updateCardioLog = vi.mocked(_updateCardioLog);
const addLog = vi.mocked(_addLog);
const addCardioLog = vi.mocked(_addCardioLog);

vi.mock('../dataManager', () => ({
  getLogsRange: vi.fn(),
  getCardioLogsRange: vi.fn(),
  getExercises: vi.fn(),
  deleteLog: vi.fn(),
  deleteCardioLog: vi.fn(),
  updateLog: vi.fn(),
  updateCardioLog: vi.fn(),
  addLog: vi.fn(),
  addCardioLog: vi.fn(),
}));

const EXERCISES = [{ id: '1', name: 'Back Squat', category: 'Legs' }];

const LIFT_LOG = { id: 'l1', date: '2026-08-02', exerciseId: '1', sets: [{ weight: '225', reps: '5' }] };
const CARDIO_LOG = { id: 'c1', date: '2026-08-02', type: 'Run', duration: '30', distance: '3' };

beforeEach(() => {
  vi.resetAllMocks();
  getLogsRange.mockResolvedValue([LIFT_LOG]);
  getCardioLogsRange.mockResolvedValue([CARDIO_LOG]);
  getExercises.mockResolvedValue(EXERCISES);
  deleteLog.mockResolvedValue(undefined);
  deleteCardioLog.mockResolvedValue([]);
  updateLog.mockResolvedValue(undefined);
  updateCardioLog.mockResolvedValue([]);
  addLog.mockResolvedValue(undefined);
  addCardioLog.mockResolvedValue([]);
});

describe('HistoryView list', () => {
  it('renders lift and cardio entries for the filtered range', async () => {
    render(<HistoryView />);
    await waitFor(() => expect(getLogsRange).toHaveBeenCalled());

    expect(await screen.findByText('Back Squat')).toBeInTheDocument();
    expect(screen.getByText('225 lbs × 5')).toBeInTheDocument();
    expect(screen.getByText('Run')).toBeInTheDocument();
    expect(screen.getByText('30 min')).toBeInTheDocument();
  });

  it('shows an empty state when nothing matches the range', async () => {
    getLogsRange.mockResolvedValue([]);
    getCardioLogsRange.mockResolvedValue([]);
    render(<HistoryView />);
    expect(await screen.findByText('No logs in this period.')).toBeInTheDocument();
  });
});

describe('HistoryView delete + undo', () => {
  it('requires confirmation before deleting, then shows an undo bar', async () => {
    render(<HistoryView />);
    await screen.findByText('Back Squat');

    fireEvent.click(screen.getAllByText('Del')[0]);
    expect(deleteLog).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByText('Confirm'));

    await waitFor(() => expect(deleteLog).toHaveBeenCalledWith('l1'));
    expect(screen.queryByText('Back Squat')).not.toBeInTheDocument();
    expect(screen.getByText('Entry deleted')).toBeInTheDocument();
  });

  it('does not delete when the confirmation is cancelled', async () => {
    render(<HistoryView />);
    await screen.findByText('Back Squat');

    fireEvent.click(screen.getAllByText('Del')[0]);
    fireEvent.click(await screen.findByText('Cancel'));

    expect(deleteLog).not.toHaveBeenCalled();
    expect(screen.getByText('Back Squat')).toBeInTheDocument();
  });

  it('Undo re-adds the deleted lift entry', async () => {
    render(<HistoryView />);
    await screen.findByText('Back Squat');

    fireEvent.click(screen.getAllByText('Del')[0]);
    fireEvent.click(await screen.findByText('Confirm'));
    await waitFor(() => expect(deleteLog).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Undo'));

    await waitFor(() => expect(addLog).toHaveBeenCalledWith('2026-08-02', '1', [{ weight: '225', reps: '5' }]));
    expect(screen.queryByText('Entry deleted')).not.toBeInTheDocument();
  });
});

describe('HistoryView edit sheet', () => {
  it('edits a lift entry and saves via updateLog', async () => {
    render(<HistoryView />);
    await screen.findByText('Back Squat');

    fireEvent.click(screen.getAllByText('Edit')[0]);
    expect(screen.getByText('Edit Entry')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('225'), { target: { value: '235' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(updateLog).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'l1', sets: [{ weight: '235', reps: '5' }] })
    ));
    expect(screen.queryByText('Edit Entry')).not.toBeInTheDocument();
  });

  it('blocks saving a lift with no complete sets', async () => {
    render(<HistoryView />);
    await screen.findByText('Back Squat');

    fireEvent.click(screen.getAllByText('Edit')[0]);
    // getAllByText('✕')[0] is the BottomSheet's own close button; [1] is the remove-set button.
    fireEvent.click(screen.getAllByText('✕')[1]);
    fireEvent.click(screen.getByText('Save'));

    expect(screen.getByText('Missing Data')).toBeInTheDocument();
    expect(updateLog).not.toHaveBeenCalled();
  });

  it('edits a cardio entry and saves via updateCardioLog', async () => {
    render(<HistoryView />);
    await screen.findByText('Run');

    fireEvent.click(screen.getAllByText('Edit')[1]);
    fireEvent.click(screen.getByText('Cycle'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(updateCardioLog).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c1', type: 'Cycle' })
    ));
  });
});
