import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import WorkoutLogger from './WorkoutLogger';
import {
  getExercises as _getExercises, getLogs as _getLogs,
  addLog as _addLog, addCardioLog as _addCardioLog,
} from '../dataManager';

// WorkoutLogger drives everything off dataManager, so the component is
// exercised against a fully mocked data layer rather than a real Supabase
// client (same convention as DailyView.test.tsx/TrendsView.test.tsx).
const getExercises = vi.mocked(_getExercises);
const getLogs = vi.mocked(_getLogs);
const addLog = vi.mocked(_addLog);
const addCardioLog = vi.mocked(_addCardioLog);

vi.mock('../dataManager', () => ({
  getExercises: vi.fn(),
  getLogs: vi.fn(),
  addLog: vi.fn(),
  addCardioLog: vi.fn(),
}));

// PlateCalculator/ConfirmModal are rendered unconditionally (isOpen=false by
// default) but pull in canvas-confetti-adjacent DOM measurement APIs jsdom
// doesn't implement fully -- not mocked, matching how DailyView.test.tsx
// leaves them real, since they no-op while closed.

const EXERCISES = [
  { id: '1', name: 'Barbell Bench Press', category: 'Chest' },
  { id: '2', name: 'Barbell Row', category: 'Back' },
  { id: '3', name: 'Back Squat', category: 'Legs' },
];

beforeEach(() => {
  vi.resetAllMocks();
  getExercises.mockResolvedValue(EXERCISES);
  getLogs.mockResolvedValue([]);
  addLog.mockResolvedValue(undefined);
  addCardioLog.mockResolvedValue([]);
  localStorage.clear();
});

describe('WorkoutLogger exercise search', () => {
  it('shows no pill results until a query is typed, then filters by substring', async () => {
    render(<WorkoutLogger />);
    await waitFor(() => expect(getExercises).toHaveBeenCalled());

    expect(screen.queryByText('Barbell Bench Press')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search exercise…'), { target: { value: 'bar' } });

    expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Barbell Row')).toBeInTheDocument();
    expect(screen.queryByText('Back Squat')).not.toBeInTheDocument();
  });

  it('selecting a result shows the exercise name and a Change link, and clears the query', async () => {
    render(<WorkoutLogger />);
    await waitFor(() => expect(getExercises).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText('Search exercise…'), { target: { value: 'squat' } });
    fireEvent.click(screen.getByText('Back Squat'));

    expect(screen.getAllByText('Back Squat')).toHaveLength(1);
    expect(screen.getByText('Change')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search exercise…')).not.toBeInTheDocument();
  });

  it('Change reverts back to the search input', async () => {
    render(<WorkoutLogger />);
    await waitFor(() => expect(getExercises).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText('Search exercise…'), { target: { value: 'squat' } });
    fireEvent.click(screen.getByText('Back Squat'));
    fireEvent.click(screen.getByText('Change'));

    expect(screen.getByPlaceholderText('Search exercise…')).toBeInTheDocument();
    expect(screen.queryByText('Change')).not.toBeInTheDocument();
  });
});

describe('WorkoutLogger lift logging', () => {
  it('requires an exercise and at least one filled set before saving', async () => {
    render(<WorkoutLogger />);
    await waitFor(() => expect(getExercises).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText('Search exercise…'), { target: { value: 'squat' } });
    fireEvent.click(screen.getByText('Back Squat'));
    fireEvent.click(screen.getByRole('button', { name: 'Log Workout' }));

    expect(screen.getByText('Missing Data')).toBeInTheDocument();
    expect(addLog).not.toHaveBeenCalled();
  });

  it('saves the lift, flashes a confirmation, and resets the exercise selection', async () => {
    render(<WorkoutLogger />);
    await waitFor(() => expect(getExercises).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText('Search exercise…'), { target: { value: 'squat' } });
    fireEvent.click(screen.getByText('Back Squat'));

    fireEvent.change(screen.getByPlaceholderText('lbs'), { target: { value: '225' } });
    fireEvent.change(screen.getByPlaceholderText('reps'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log Workout' }));

    await waitFor(() => expect(addLog).toHaveBeenCalledWith(
      expect.any(String), '3', [{ weight: '225', reps: '5' }]
    ));

    expect(await screen.findByText('Workout logged ✓')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search exercise…')).toBeInTheDocument();
  });

  it('adding a set copies the previous set\'s values', async () => {
    render(<WorkoutLogger />);
    await waitFor(() => expect(getExercises).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText('Search exercise…'), { target: { value: 'squat' } });
    fireEvent.click(screen.getByText('Back Squat'));
    fireEvent.change(screen.getByPlaceholderText('lbs'), { target: { value: '225' } });
    fireEvent.change(screen.getByPlaceholderText('reps'), { target: { value: '5' } });

    fireEvent.click(screen.getByText('+ Set'));

    expect(screen.getAllByPlaceholderText('lbs').map(el => (el as HTMLInputElement).value)).toEqual(['225', '225']);
    expect(screen.getAllByPlaceholderText('reps').map(el => (el as HTMLInputElement).value)).toEqual(['5', '5']);
  });
});

describe('WorkoutLogger cardio logging', () => {
  it('requires a duration before saving', async () => {
    render(<WorkoutLogger />);
    await waitFor(() => expect(getExercises).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Cardio'));
    fireEvent.click(screen.getByText('Log Cardio'));

    expect(screen.getByText('Missing Data')).toBeInTheDocument();
    expect(addCardioLog).not.toHaveBeenCalled();
  });

  it('saves the selected cardio type/duration/distance and flashes a confirmation', async () => {
    render(<WorkoutLogger />);
    await waitFor(() => expect(getExercises).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Cardio'));
    fireEvent.click(screen.getByText('Cycle'));
    fireEvent.change(screen.getByPlaceholderText('minutes'), { target: { value: '30' } });
    fireEvent.change(screen.getByPlaceholderText('mi (opt)'), { target: { value: '8.4' } });
    fireEvent.click(screen.getByText('Log Cardio'));

    await waitFor(() => expect(addCardioLog).toHaveBeenCalledWith(expect.any(String), 'Cycle', '30', '8.4'));
    expect(await screen.findByText('Cardio logged ✓')).toBeInTheDocument();
  });
});
