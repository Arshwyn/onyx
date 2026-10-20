import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import RoutineManager from './RoutineManager';
import {
  getExercises as _getExercises, getRoutines as _getRoutines, saveRoutine as _saveRoutine,
  deleteRoutine as _deleteRoutine,
} from '../dataManager';
import type { Exercise, Routine } from '../types';

const getExercises = vi.mocked(_getExercises);
const getRoutines = vi.mocked(_getRoutines);
const saveRoutine = vi.mocked(_saveRoutine);
const deleteRoutine = vi.mocked(_deleteRoutine);

vi.mock('../dataManager', () => ({
  getExercises: vi.fn(),
  getRoutines: vi.fn(),
  saveRoutine: vi.fn(),
  deleteRoutine: vi.fn(),
  addExercise: vi.fn(),
  deleteCustomExercise: vi.fn(),
}));

const EXERCISES: Exercise[] = [
  { id: 'ex_1', name: 'Barbell Squat', mechanic: 'compound' },
  { id: 'ex_2', name: 'Bicep Curl', mechanic: 'isolation' },
  { id: 'custom_3', name: 'Weird New Move' }, // no mechanic classification
];

beforeEach(() => {
  vi.resetAllMocks();
  getExercises.mockResolvedValue(EXERCISES);
  getRoutines.mockResolvedValue([]);
  saveRoutine.mockResolvedValue([{ id: 'new1', days: [], name: 'New Routine', exercises: [], cardio: [] }]);
  deleteRoutine.mockResolvedValue(undefined);
});

// Quick-adds a fresh routine from the list screen (typing a name + Add),
// which opens straight into its detail/edit screen -- the only way to reach
// the exercise picker for a brand-new routine in the list<->detail flow.
const createAndOpenRoutine = async (name = 'New Routine') => {
  saveRoutine.mockResolvedValueOnce([{ id: 'new1', days: [], name, exercises: [], cardio: [] }]);
  render(<RoutineManager onBack={() => {}} />);
  await waitFor(() => expect(screen.getByPlaceholderText('New routine name')).toBeInTheDocument());
  fireEvent.change(screen.getByPlaceholderText('New routine name'), { target: { value: name } });
  fireEvent.click(screen.getByText('Add'));
  await waitFor(() => expect(screen.getByPlaceholderText('Search or create exercise...')).toBeInTheDocument());
};

const selectExercise = async (name: string) => {
  const search = screen.getByPlaceholderText('Search or create exercise...');
  fireEvent.change(search, { target: { value: name } });
  const option = await screen.findByText(name);
  fireEvent.click(option);
};

// Scoped to the "Exercises" section, not the whole sheet -- the Planned
// Cardio duration field below it is also a spinbutton and would otherwise
// shift every index by one.
const setsAndRepsInputs = () => {
  const section = screen.getByText('Exercises').closest('.mb-4') as HTMLElement;
  return within(section).getAllByRole('spinbutton');
};

describe('RoutineManager rep-range', () => {
  it('pre-fills a compound exercise with the 5-8 rep range', async () => {
    await createAndOpenRoutine();
    await selectExercise('Barbell Squat');

    const [sets, repMin, repMax] = setsAndRepsInputs();
    expect((sets as HTMLInputElement).value).toBe('3');
    expect((repMin as HTMLInputElement).value).toBe('5');
    expect((repMax as HTMLInputElement).value).toBe('8');
  });

  it('pre-fills an isolation exercise with the 10-15 rep range', async () => {
    await createAndOpenRoutine();
    await selectExercise('Bicep Curl');

    const [sets, repMin, repMax] = setsAndRepsInputs();
    expect((sets as HTMLInputElement).value).toBe('3');
    expect((repMin as HTMLInputElement).value).toBe('10');
    expect((repMax as HTMLInputElement).value).toBe('15');
  });

  it('falls back to a fixed 3x10 for an exercise with no mechanic classification', async () => {
    await createAndOpenRoutine();
    await selectExercise('Weird New Move');

    const [sets, repMin, repMax] = setsAndRepsInputs();
    expect((sets as HTMLInputElement).value).toBe('3');
    expect((repMin as HTMLInputElement).value).toBe('10');
    expect((repMax as HTMLInputElement).value).toBe('');
  });

  it('serializes without a repMax key when the range is left blank (fixed target)', async () => {
    await createAndOpenRoutine('Accessory Day');
    await selectExercise('Weird New Move');

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => expect(saveRoutine).toHaveBeenCalledTimes(2));
    const saved = saveRoutine.mock.calls[1][0];
    expect(saved.name).toBe('Accessory Day');
    expect(saved.exercises).toEqual([{ id: 'custom_3', sets: 3, reps: 10, repMax: undefined }]);
  });

  it('round-trips a saved rep range: value survives save then re-edit', async () => {
    const routine: Routine = {
      id: 'r1',
      days: ['Monday'],
      name: 'Leg Day',
      exercises: [{ id: 'ex_1', sets: 4, reps: 6, repMax: 9 }],
      cardio: [],
    };
    getRoutines.mockResolvedValue([routine]);

    render(<RoutineManager onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('Leg Day')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Leg Day'));

    const [sets, repMin, repMax] = setsAndRepsInputs();
    expect((sets as HTMLInputElement).value).toBe('4');
    expect((repMin as HTMLInputElement).value).toBe('6');
    expect((repMax as HTMLInputElement).value).toBe('9');

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => expect(saveRoutine).toHaveBeenCalled());
    const saved = saveRoutine.mock.calls[0][0];
    expect(saved.exercises).toEqual([{ id: 'ex_1', sets: 4, reps: 6, repMax: 9 }]);
    expect(saved.days).toEqual(['Monday']);
  });
});

describe('RoutineManager list <-> detail navigation', () => {
  it('shows assigned days and exercise count for each routine in the list', async () => {
    getRoutines.mockResolvedValue([
      { id: 'r1', days: ['Monday', 'Thursday'], name: 'Push Day', exercises: [{ id: 'ex_1' }, { id: 'ex_2' }], cardio: [] },
      { id: 'r2', days: [], name: 'Untitled', exercises: [], cardio: [] },
    ]);

    render(<RoutineManager onBack={() => {}} />);

    await waitFor(() => expect(screen.getByText('Push Day')).toBeInTheDocument());
    expect(screen.getByText('2 exercises · Mon, Thu')).toBeInTheDocument();
    expect(screen.getByText('0 exercises · Unassigned')).toBeInTheDocument();
  });

  it('deletes a routine from the list after confirming', async () => {
    getRoutines.mockResolvedValue([{ id: 'r1', days: ['Monday'], name: 'Push Day', exercises: [], cardio: [] }]);

    render(<RoutineManager onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('Push Day')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Delete Push Day'));
    fireEvent.click(await screen.findByText('Confirm'));

    await waitFor(() => expect(deleteRoutine).toHaveBeenCalledWith('r1'));
  });

  it('toggles multiple assigned days for a routine', async () => {
    const routine: Routine = { id: 'r1', days: ['Monday'], name: 'Push Day', exercises: [{ id: 'ex_1', sets: 3, reps: 8 }], cardio: [] };
    getRoutines.mockResolvedValue([routine]);

    render(<RoutineManager onBack={() => {}} />);
    fireEvent.click(await screen.findByText('Push Day'));

    fireEvent.click(screen.getByRole('button', { name: 'THU' }));
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => expect(saveRoutine).toHaveBeenCalled());
    const saved = saveRoutine.mock.calls[0][0];
    expect(saved.days).toEqual(['Monday', 'Thursday']);
  });

  it('creates a brand-new custom exercise inline from the add-exercise search', async () => {
    const { addExercise } = await import('../dataManager');
    vi.mocked(addExercise).mockResolvedValue(undefined);

    await createAndOpenRoutine();

    // Only the *next* getExercises call (triggered by the inline create
    // below) should see the new exercise -- mount and the quick-add's own
    // reload already resolved against the plain EXERCISES fixture above.
    getExercises.mockResolvedValueOnce([...EXERCISES, { id: 'custom_9', name: 'Bulgarian Split Squat' }]);

    const search = screen.getByPlaceholderText('Search or create exercise...');
    fireEvent.change(search, { target: { value: 'Bulgarian Split Squat' } });

    fireEvent.click(await screen.findByText('+ Create "Bulgarian Split Squat" as new exercise'));

    await waitFor(() => expect(addExercise).toHaveBeenCalledWith('Bulgarian Split Squat', null));
    expect(await screen.findByText('Bulgarian Split Squat')).toBeInTheDocument();
  });

  it('passes the picked mechanic through when creating a new custom exercise', async () => {
    const { addExercise } = await import('../dataManager');
    vi.mocked(addExercise).mockResolvedValue(undefined);

    await createAndOpenRoutine();

    getExercises.mockResolvedValueOnce([...EXERCISES, { id: 'custom_9', name: 'Cable Fly', mechanic: 'isolation' }]);

    const search = screen.getByPlaceholderText('Search or create exercise...');
    fireEvent.change(search, { target: { value: 'Cable Fly' } });

    fireEvent.click(await screen.findByText('Isolation'));
    fireEvent.click(await screen.findByText('+ Create "Cable Fly" as new exercise'));

    await waitFor(() => expect(addExercise).toHaveBeenCalledWith('Cable Fly', 'isolation'));
  });
});

describe('RoutineManager Rest Day detection', () => {
  it('auto-detects a pre-existing empty routine as Rest Day regardless of its name', async () => {
    // Historical data: any empty (no exercises/cardio) routine used to be
    // treated as Rest Day no matter what it was named -- name-based
    // detection alone would miss this for a routine someone named "Off"
    // instead of "Rest Day".
    getRoutines.mockResolvedValue([{ id: 'r1', days: ['Sunday'], name: 'Off', exercises: [], cardio: [] }]);

    render(<RoutineManager onBack={() => {}} />);
    fireEvent.click(await screen.findByText('Off'));

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByPlaceholderText('e.g. Heavy Legs')).toHaveValue('Rest Day');
  });

  it('does not auto-detect a freshly quick-added routine as Rest Day before it has been configured', async () => {
    await createAndOpenRoutine('Untitled');

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByPlaceholderText('e.g. Heavy Legs')).toHaveValue('Untitled');
  });
});
