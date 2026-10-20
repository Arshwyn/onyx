import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsView from './SettingsView';
import {
  updateUserSettings as _updateUserSettings,
  getUserSettings as _getUserSettings,
  getExercises as _getExercises,
  addExercise as _addExercise,
  deleteCustomExercise as _deleteCustomExercise,
  getRoutines as _getRoutines,
  getLogs as _getLogs,
  getCardioLogs as _getCardioLogs,
  getBodyWeights as _getBodyWeights,
  getCircumferences as _getCircumferences,
} from '../dataManager';
import { supabase } from '../supabaseClient';

const updateUserSettings = vi.mocked(_updateUserSettings);
const getUserSettings = vi.mocked(_getUserSettings);
const getExercises = vi.mocked(_getExercises);
const addExercise = vi.mocked(_addExercise);
const deleteCustomExercise = vi.mocked(_deleteCustomExercise);
const getRoutines = vi.mocked(_getRoutines);
const getLogs = vi.mocked(_getLogs);
const getCardioLogs = vi.mocked(_getCardioLogs);
const getBodyWeights = vi.mocked(_getBodyWeights);
const getCircumferences = vi.mocked(_getCircumferences);

// RoutineManager is rendered for real (not mocked) now that "Manage Routines"
// opens it in place rather than navigating to a separate route -- it shares
// this same '../dataManager' mock, so saveRoutine/deleteRoutine need entries
// too even though no test here asserts on them directly.
vi.mock('../dataManager', () => ({
  updateUserSettings: vi.fn(),
  getUserSettings: vi.fn(),
  getExercises: vi.fn(),
  addExercise: vi.fn(),
  deleteCustomExercise: vi.fn(),
  getRoutines: vi.fn(),
  saveRoutine: vi.fn(),
  deleteRoutine: vi.fn(),
  getLogs: vi.fn(),
  getCardioLogs: vi.fn(),
  getBodyWeights: vi.fn(),
  getCircumferences: vi.fn(),
}));

vi.mock('../supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

const getUser = vi.mocked(supabase.auth.getUser);
const signOut = vi.mocked(supabase.auth.signOut);
const updateUser = vi.mocked(supabase.auth.updateUser);

const EXERCISES = [
  { id: 'ex_1', name: 'Back Squat' },
  { id: 'custom_1', name: 'My Curl' },
];
const ROUTINES = [{ id: 'r1', days: ['Monday'], name: 'Push Day', exercises: [] }];

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();

  getUser.mockResolvedValue({
    data: { user: { email: 'lifter@example.com', created_at: '2025-01-15T00:00:00.000Z', user_metadata: {} } },
  } as never);
  getUserSettings.mockResolvedValue(null);
  updateUser.mockResolvedValue({ data: { user: {} }, error: null } as never);
  getExercises.mockResolvedValue(EXERCISES as never);
  getRoutines.mockResolvedValue(ROUTINES as never);
  addExercise.mockResolvedValue(undefined as never);
  deleteCustomExercise.mockResolvedValue(undefined as never);
  getLogs.mockResolvedValue([] as never);
  getCardioLogs.mockResolvedValue([] as never);
  getBodyWeights.mockResolvedValue([] as never);
  getCircumferences.mockResolvedValue([] as never);
});

afterEach(() => {
  localStorage.clear();
});

describe('SettingsView', () => {
  it('renders profile info and unit rows once loaded', async () => {
    render(<SettingsView resetTrigger={0} />);

    expect(await screen.findByText('lifter@example.com')).toBeInTheDocument();
    expect(screen.getByText('Member since Jan 2025')).toBeInTheDocument();
    expect(screen.getByText('Weight Unit')).toBeInTheDocument();
    expect(await screen.findByText('1 exercise')).toBeInTheDocument();
    expect(await screen.findByText('1 routine')).toBeInTheDocument();
  });

  it('flips a unit and persists it to localStorage + Supabase', async () => {
    const user = userEvent.setup();
    render(<SettingsView resetTrigger={0} />);
    await screen.findByText('lifter@example.com');

    await user.click(screen.getByRole('button', { name: 'KG' }));

    expect(localStorage.getItem('onyx_unit_weight')).toBe('kg');
    expect(updateUserSettings).toHaveBeenCalledWith({ weight_unit: 'kg' });
  });

  it('selects a default bar weight chip and syncs it to localStorage + Supabase', async () => {
    const user = userEvent.setup();
    render(<SettingsView resetTrigger={0} />);
    await screen.findByText('lifter@example.com');

    // Default Bar Weight now lives behind a NavRow -> modal (not inline)
    // instead of cluttering the main list.
    await user.click(screen.getByText('Default Bar Weight'));
    await user.click(screen.getByRole('button', { name: '35 lbs' }));

    expect(localStorage.getItem('onyx_default_bar_weight')).toBe('35');
    expect(updateUserSettings).toHaveBeenCalledWith({ default_bar_weight: 35 });
  });

  it('falls back to the first chip (display-only) when switching units makes the saved default_bar_weight unavailable', async () => {
    const user = userEvent.setup();
    render(<SettingsView resetTrigger={0} />);
    await screen.findByText('lifter@example.com');

    await user.click(screen.getByText('Default Bar Weight'));
    await user.click(screen.getByRole('button', { name: '35 lbs' }));
    expect(screen.getByRole('button', { name: '35 lbs' }).className).toContain('bg-accent');

    // Weight Unit lives on the main screen, behind the bar-weight sheet --
    // close it first, same as a real user would have to.
    await user.click(screen.getByLabelText('Close'));

    // 35 isn't a kg chip -- should visually fall back to the first kg chip (20)
    // without silently overwriting the saved lbs preference underneath.
    await user.click(screen.getByRole('button', { name: 'KG' }));
    expect(localStorage.getItem('onyx_default_bar_weight')).toBe('35');

    await user.click(screen.getByText('Default Bar Weight'));
    expect(screen.getByRole('button', { name: '20 kg' }).className).toContain('bg-accent');
    await user.click(screen.getByLabelText('Close'));

    // Switching back to lbs restores the original selection.
    await user.click(screen.getByRole('button', { name: 'LBS' }));
    await user.click(screen.getByText('Default Bar Weight'));
    expect(screen.getByRole('button', { name: '35 lbs' }).className).toContain('bg-accent');
  });

  it('opens Manage Routines in place, without navigating away or remounting Settings', async () => {
    const user = userEvent.setup();
    render(<SettingsView resetTrigger={0} />);
    await screen.findByText('lifter@example.com');

    await user.click(screen.getByText('Manage Routines'));

    // Comes from the real (unmocked) RoutineManager rendered in place --
    // regression coverage for it behaving like Custom Exercises/Export (a
    // same-page overlay) instead of the old dedicated route, which used to
    // unmount SettingsView and remount it fresh on the way back.
    expect(await screen.findByText('Push Day')).toBeInTheDocument();
    expect(screen.getByText('lifter@example.com')).toBeInTheDocument();
  });

  it('opens the Custom Exercises sheet, lists only custom exercises, and adds a new one', async () => {
    const user = userEvent.setup();
    render(<SettingsView resetTrigger={0} />);
    await screen.findByText('lifter@example.com');

    await user.click(screen.getByText('Custom Exercises'));

    expect(await screen.findByText('My Curl')).toBeInTheDocument();
    expect(screen.queryByText('Back Squat')).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Exercise name'), 'Cable Fly');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(addExercise).toHaveBeenCalledWith('Cable Fly', null);
  });

  it('passes the picked mechanic through when adding a custom exercise', async () => {
    const user = userEvent.setup();
    render(<SettingsView resetTrigger={0} />);
    await screen.findByText('lifter@example.com');

    await user.click(screen.getByText('Custom Exercises'));
    await screen.findByText('My Curl');

    await user.type(screen.getByPlaceholderText('Exercise name'), 'Leg Press');
    await user.click(screen.getByRole('button', { name: 'Compound' }));
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(addExercise).toHaveBeenCalledWith('Leg Press', 'compound');
  });

  it('lets you retype over a 0 in the Progression Settings inputs instead of getting stuck at "0X"', async () => {
    // Regression: Weight Step used `value ?? ''` and the rep-range inputs had
    // no empty-string fallback at all, so a 0 value rendered as a literal "0"
    // that couldn't be cleared -- the field snapped back to "0" before the
    // next keystroke landed, turning a typed "7" into "07". `value || ''`
    // (already used by the Rest Timer Quick-Add inputs) treats 0 as falsy and
    // renders empty instead.
    const user = userEvent.setup();
    render(<SettingsView resetTrigger={0} />);
    await screen.findByText('lifter@example.com');

    await user.click(screen.getByText('Progression Suggestions'));
    await screen.findByText('Progression Settings');

    const [stepInput, setsInput] = screen.getAllByRole('spinbutton') as HTMLInputElement[];

    await user.clear(stepInput);
    expect(stepInput.value).toBe('');
    await user.type(stepInput, '7');
    expect(stepInput.value).toBe('7');

    await user.clear(setsInput);
    expect(setsInput.value).toBe('');
    await user.type(setsInput, '4');
    expect(setsInput.value).toBe('4');
  });

  it('does not blank the other rep-range field when typing an out-of-order min/max value', async () => {
    // Regression: handleUpdateMechanicRange used to cross-clamp repMin/repMax
    // on every keystroke, and since parseInt('') coerces to 0 mid-edit, a
    // momentarily-empty field pushed the *other* field to 0 too -- both
    // inputs would blank out before the user finished typing. Editing is now
    // purely local state until Save, so an inverted value just sits there.
    const user = userEvent.setup();
    render(<SettingsView resetTrigger={0} />);
    await screen.findByText('lifter@example.com');

    await user.click(screen.getByText('Progression Suggestions'));
    await screen.findByText('Progression Settings');

    // spinbuttons: [0]=Weight Step, [1..3]=Compound Sets/Min/Max, [4..6]=Isolation Sets/Min/Max
    const [, , compoundMin, compoundMax] = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    expect(compoundMin.value).toBe('5');

    await user.clear(compoundMax);
    await user.type(compoundMax, '3'); // below the default Min Reps of 5

    expect(compoundMin.value).toBe('5');
    expect(compoundMax.value).toBe('3');
    expect(updateUserSettings).not.toHaveBeenCalled();
  });

  it('blocks Save and shows an error when Min Reps is greater than Max Reps', async () => {
    const user = userEvent.setup();
    render(<SettingsView resetTrigger={0} />);
    await screen.findByText('lifter@example.com');

    await user.click(screen.getByText('Progression Suggestions'));
    await screen.findByText('Progression Settings');

    const [, , , compoundMax] = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    await user.clear(compoundMax);
    await user.type(compoundMax, '3');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText("Compound Min Reps can't be greater than Max Reps.")).toBeInTheDocument();
    expect(updateUserSettings).not.toHaveBeenCalled();
    expect(screen.getByText('Progression Settings')).toBeInTheDocument();
  });

  it('persists Progression Settings only once Save is tapped and validation passes', async () => {
    const user = userEvent.setup();
    render(<SettingsView resetTrigger={0} />);
    await screen.findByText('lifter@example.com');

    await user.click(screen.getByText('Progression Suggestions'));
    await screen.findByText('Progression Settings');

    const [, , compoundMin, compoundMax] = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    await user.clear(compoundMin);
    await user.type(compoundMin, '6');
    await user.clear(compoundMax);
    await user.type(compoundMax, '10');

    // Editing alone shouldn't write anywhere yet.
    expect(updateUserSettings).not.toHaveBeenCalled();
    expect(localStorage.getItem('onyx_mechanic_rep_defaults')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(updateUserSettings).toHaveBeenCalledWith({
      mechanic_rep_defaults: {
        compound: { sets: 3, repMin: 6, repMax: 10 },
        isolation: { sets: 3, repMin: 10, repMax: 15 },
      },
    });
    expect(JSON.parse(localStorage.getItem('onyx_mechanic_rep_defaults')!).compound).toEqual({ sets: 3, repMin: 6, repMax: 10 });
    expect(screen.queryByText('Progression Settings')).not.toBeInTheDocument();
  });

  it('discards edits without persisting when Cancel is tapped', async () => {
    const user = userEvent.setup();
    render(<SettingsView resetTrigger={0} />);
    await screen.findByText('lifter@example.com');

    await user.click(screen.getByText('Progression Suggestions'));
    await screen.findByText('Progression Settings');

    const [, , compoundMin] = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    await user.clear(compoundMin);
    await user.type(compoundMin, '1');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(updateUserSettings).not.toHaveBeenCalled();
    expect(localStorage.getItem('onyx_mechanic_rep_defaults')).toBeNull();

    await user.click(screen.getByText('Progression Suggestions'));
    await screen.findByText('Progression Settings');
    const reopened = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    expect(reopened[2].value).toBe('5');
  });

  it('signs out via Supabase when Sign Out is tapped', async () => {
    const user = userEvent.setup();
    render(<SettingsView resetTrigger={0} />);
    await screen.findByText('lifter@example.com');

    await user.click(screen.getByRole('button', { name: 'Sign Out' }));
    expect(signOut).toHaveBeenCalled();
  });
});

describe('SettingsView profile sheet', () => {
  it('displays the name from user_settings, not auth metadata, falling back to email when null', async () => {
    getUserSettings.mockResolvedValue({ name: 'Alex Chen', weight_unit: 'lbs', measure_unit: 'in', timer_increments: [30, 60, 90] });

    render(<SettingsView resetTrigger={0} />);

    expect(await screen.findByText('Alex Chen')).toBeInTheDocument();
  });

  it('saves a name change via updateUserSettings without prompting when email is unchanged', async () => {
    const user = userEvent.setup();
    render(<SettingsView resetTrigger={0} />);
    await user.click(await screen.findByText('lifter@example.com'));

    await screen.findByText('Profile');
    const nameInput = screen.getByPlaceholderText('Your name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Alex Chen');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.queryByText('Change Email?')).not.toBeInTheDocument();
    expect(updateUserSettings).toHaveBeenCalledWith({ name: 'Alex Chen' });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('requires confirmation before changing email, and only applies it once confirmed', async () => {
    const user = userEvent.setup();
    render(<SettingsView resetTrigger={0} />);
    await user.click(await screen.findByText('lifter@example.com'));

    const emailInput = await screen.findByDisplayValue('lifter@example.com');
    await user.clear(emailInput);
    await user.type(emailInput, 'new@example.com');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const confirmDialog = (await screen.findByText('Change Email?')).closest('.rounded-xl') as HTMLElement;
    expect(updateUser).not.toHaveBeenCalled();

    // Cancel backs out entirely -- no update fired. Scoped to the confirm
    // dialog specifically since the sheet's own footer also has a "Cancel".
    await user.click(within(confirmDialog).getByText('Cancel'));
    expect(updateUser).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(await screen.findByText('Confirm'));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ email: 'new@example.com' }));
  });

  it('reflects a name change immediately even when the paired email update fails', async () => {
    // Regression: the name write (updateUserSettings) and the auth write
    // (supabase.auth.updateUser, for email/password) are separate calls --
    // if the name save succeeds but the auth call errors afterward, the
    // sheet must still show the new name rather than reverting to stale
    // local state for a change that already landed server-side.
    updateUser.mockResolvedValue({ data: { user: {} }, error: { message: 'email already in use' } } as never);

    const user = userEvent.setup();
    render(<SettingsView resetTrigger={0} />);
    await user.click(await screen.findByText('lifter@example.com'));

    const nameInput = screen.getByPlaceholderText('Your name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Alex Chen');

    const emailInput = await screen.findByDisplayValue('lifter@example.com');
    await user.clear(emailInput);
    await user.type(emailInput, 'taken@example.com');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(await screen.findByText('Confirm'));

    await waitFor(() => expect(updateUserSettings).toHaveBeenCalledWith({ name: 'Alex Chen' }));
    await waitFor(() => expect(screen.getByText('Error: email already in use')).toBeInTheDocument());

    // The name change already persisted -- closing and reopening the
    // profile card should show it, not the pre-save name.
    await user.click(screen.getByLabelText('Close'));
    expect(await screen.findByText('Alex Chen')).toBeInTheDocument();
  });
});
