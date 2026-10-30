import React, { useState, useEffect, lazy, Suspense } from 'react';
import { supabase } from '../supabaseClient';
import {
  updateUserSettings,
  getUserSettings,
  getExercises,
  addExercise,
  deleteCustomExercise,
  getRoutines,
  getLogs,
  getCardioLogs,
  getBodyWeights,
  getCircumferences
} from '../dataManager';
import ConfirmModal from './ConfirmModal';
import Card from './ui/Card';
import MicroLabel from './ui/MicroLabel';
import Pill from './ui/Pill';
import ToggleSwitch from './ui/ToggleSwitch';
import BottomSheet from './ui/BottomSheet';
import { BAR_OPTIONS_LBS, BAR_OPTIONS_KG } from '../lib/plateOptions';
import { getMechanicRepDefaults, type MechanicRepDefaults, type MechanicRepRange } from '../lib/mechanicDefaults';
import type { Exercise } from '../types';

// Lazy so its code only downloads once a user actually opens it, same
// reasoning as every other React.lazy split in App.tsx -- this just moves
// the split point since RoutineManager is no longer its own route (see
// "Manage Routines" below).
const RoutineManager = lazy(() => import('./RoutineManager'));

interface ModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: (() => void) | null;
  isDestructive: boolean;
}

interface SettingsViewProps {
  resetTrigger: number;
}

interface Profile {
  email: string;
  name: string;
  memberSince: string | null;
}

function getInitials(name: string, email: string): string {
  const source = name.trim() || email.split('@')[0] || '';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase() || '?';
}

function formatMemberSince(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `Member since ${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
}

const readStr = (key: string, fallback: string) => localStorage.getItem(key) || fallback;
const readFlag = (key: string) => localStorage.getItem(key) !== 'false';

function readTimerIncs(): number[] {
  const saved = localStorage.getItem('onyx_timer_incs');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length === 3) return parsed;
    } catch (e) {
      console.error("Error parsing timer settings", e);
    }
  }
  return [30, 60, 90];
}

function readProgressionStep(): number {
  const saved = parseFloat(localStorage.getItem('onyx_progression_step') || '');
  if (!isNaN(saved)) return saved;
  return readStr('onyx_unit_weight', 'lbs') === 'kg' ? 2.5 : 5;
}

// Mirrors the `user_settings.default_bar_weight` column, same as every other
// pref -- App.tsx's syncSettings() writes this key on load/change.
function readDefaultBarWeight(): number | null {
  const saved = parseFloat(localStorage.getItem('onyx_default_bar_weight') || '');
  return !isNaN(saved) ? saved : null;
}

export default function SettingsView({ resetTrigger }: SettingsViewProps) {
  const [profile, setProfile] = useState<Profile>({ email: '', name: '', memberSince: null });

  const [weightUnit, setWeightUnit] = useState(() => readStr('onyx_unit_weight', 'lbs'));
  const [measureUnit, setMeasureUnit] = useState(() => readStr('onyx_unit_measure', 'in'));
  const [distUnit, setDistUnit] = useState(() => readStr('onyx_unit_distance', 'mi'));
  const [timerIncs, setTimerIncs] = useState<number[]>(readTimerIncs);
  const [defaultBarWeight, setDefaultBarWeight] = useState<number | null>(readDefaultBarWeight);

  const [showTimer, setShowTimer] = useState(() => readFlag('onyx_show_timer'));
  const [showConfetti, setShowConfetti] = useState(() => readFlag('onyx_show_confetti'));
  const [showBW, setShowBW] = useState(() => readFlag('onyx_show_bw'));
  const [showMeas, setShowMeas] = useState(() => readFlag('onyx_show_meas'));

  // Default-off, unlike every toggle above.
  const [progressionEnabled, setProgressionEnabled] = useState(() => localStorage.getItem('onyx_progression_enabled') === 'true');
  const [progressionStep, setProgressionStep] = useState(readProgressionStep);

  const [mechanicDefaults, setMechanicDefaults] = useState<MechanicRepDefaults>(getMechanicRepDefaults());

  const [exerciseCount, setExerciseCount] = useState<number | null>(null);
  const [routineCount, setRoutineCount] = useState<number | null>(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [customExOpen, setCustomExOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [routinesOpen, setRoutinesOpen] = useState(false);
  const [barWeightOpen, setBarWeightOpen] = useState(false);
  const [timerIncsOpen, setTimerIncsOpen] = useState(false);
  // Weight Step and Default Rep Ranges are one combined sheet, reached via
  // the Progression Suggestions ribbon -- they used to be two separate
  // sheets (Default Rep Ranges its own NavRow, Weight Step nested under the
  // Progression Suggestions toggle).
  const [progressionSettingsOpen, setProgressionSettingsOpen] = useState(false);

  // A new resetTrigger collapses every sheet back to the hub. Adjusted while
  // rendering (not in an effect); only the scroll side effect needs an effect.
  const [seenResetTrigger, setSeenResetTrigger] = useState(resetTrigger);
  if (seenResetTrigger !== resetTrigger) {
    setSeenResetTrigger(resetTrigger);
    if (resetTrigger > 0) {
      setProfileOpen(false);
      setCustomExOpen(false);
      setExportOpen(false);
      setRoutinesOpen(false);
      setBarWeightOpen(false);
      setTimerIncsOpen(false);
      setProgressionSettingsOpen(false);
    }
  }

  useEffect(() => {
    if (resetTrigger > 0) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [resetTrigger]);

  useEffect(() => {
    // name lives in user_settings.name (nullable -- falls back to email when
    // unset, see getInitials/the profile display below), not Supabase Auth
    // metadata -- it's just another per-user field alongside every other
    // preference already stored there.
    Promise.all([supabase.auth.getUser(), getUserSettings().catch(() => null)]).then(([{ data: { user } }, settings]) => {
      if (user) {
        setProfile({
          email: user.email || '',
          name: settings?.name || '',
          memberSince: user.created_at || null
        });
      }
    });

    getExercises().then((data) => setExerciseCount(data.filter((ex) => !String(ex.id).startsWith('ex_')).length));
    getRoutines().then((data) => setRoutineCount(data.length));
  }, []);

  const handleUpdateSetting = (value, storageKey, dbKey) => {
    localStorage.setItem(storageKey, value);
    window.dispatchEvent(new Event('storage'));
    updateUserSettings({ [dbKey]: value });
  };

  const handleUpdateTimerIncs = (newIncs) => {
    setTimerIncs(newIncs);
    localStorage.setItem('onyx_timer_incs', JSON.stringify(newIncs));
    window.dispatchEvent(new Event('storage'));
    updateUserSettings({ timer_increments: newIncs });
  };

  const handleUpdateDefaultBarWeight = (w: number) => {
    setDefaultBarWeight(w);
    handleUpdateSetting(w, 'onyx_default_bar_weight', 'default_bar_weight');
  };

  const handleTimerChange = (index, value) => {
    const val = parseInt(value);
    const newIncs = [...timerIncs];
    newIncs[index] = isNaN(val) ? 0 : val;
    handleUpdateTimerIncs(newIncs);
  };

  // Progression Settings (Weight Step + rep ranges) used to write to
  // localStorage/Supabase on every keystroke, which meant a momentarily
  // inverted repMin/repMax (typing "1" over an existing "8" passes through
  // "1" before the second digit lands) triggered a live cross-clamp that
  // fought the user's typing. The sheet now edits local state only --
  // ProgressionSettingsSheet owns its own draft and lets any value be typed
  // freely -- and this is the single commit point, called once from its
  // Save button after that sheet's own validation passes.
  const handleSaveProgressionSettings = (step: number, defaults: MechanicRepDefaults) => {
    setProgressionStep(step);
    localStorage.setItem('onyx_progression_step', String(step));
    updateUserSettings({ progression_step: step });

    setMechanicDefaults(defaults);
    localStorage.setItem('onyx_mechanic_rep_defaults', JSON.stringify(defaults));
    updateUserSettings({ mechanic_rep_defaults: defaults });

    window.dispatchEvent(new Event('storage'));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const barOptions = weightUnit === 'kg' ? BAR_OPTIONS_KG : BAR_OPTIONS_LBS;
  // default_bar_weight is a single unit-less column, so a saved lbs value (e.g. 45)
  // isn't a member of BAR_OPTIONS_KG once the unit is switched. Falling back to the
  // first chip for display only (not persisting anything) mirrors PlateCalculator's
  // own fallback and keeps the saved lbs/kg preference intact underneath -- switching
  // units and switching back still shows the original selection.
  const activeBarWeight = defaultBarWeight !== null && barOptions.includes(defaultBarWeight) ? defaultBarWeight : barOptions[0];

  return (
    <div className="w-full max-w-md mx-auto text-white pb-20 overflow-x-hidden animate-fade-in">
      <h1 className="font-display font-bold italic text-2xl uppercase text-white mt-1.5 mb-3.5">Settings</h1>

      <Card className="flex items-center justify-between gap-3 mb-3.5 cursor-pointer" onClick={() => setProfileOpen(true)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-pill bg-[#1e3a5f] text-accent-light font-display font-bold text-sm flex items-center justify-center shrink-0">
            {getInitials(profile.name, profile.email)}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{profile.name || profile.email || 'Loading...'}</div>
            <div className="text-[11px] text-text-muted truncate">{formatMemberSince(profile.memberSince)}</div>
          </div>
        </div>
        <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
      </Card>

      <div className="bg-surface border border-border rounded-card overflow-hidden divide-y divide-border mb-3.5">
        <UnitRow label="Weight Unit" value={weightUnit} options={[['lbs', 'LBS'], ['kg', 'KG']]} onChange={(v) => { setWeightUnit(v); handleUpdateSetting(v, 'onyx_unit_weight', 'weight_unit'); }} />
        <UnitRow label="Measurement Unit" value={measureUnit} options={[['in', 'IN'], ['cm', 'CM']]} onChange={(v) => { setMeasureUnit(v); handleUpdateSetting(v, 'onyx_unit_measure', 'measure_unit'); }} />
        <UnitRow label="Distance Unit" value={distUnit} options={[['mi', 'MI'], ['km', 'KM']]} onChange={(v) => { setDistUnit(v); handleUpdateSetting(v, 'onyx_unit_distance', 'distance_unit'); }} />
      </div>

      <div className="bg-surface border border-border rounded-card overflow-hidden divide-y divide-border mb-3.5">
        <ToggleRow label="Confetti Celebration" checked={showConfetti} onChange={(v) => { setShowConfetti(v); handleUpdateSetting(v, 'onyx_show_confetti', 'show_confetti'); }} />
        <ToggleRow label="Show Body Weight" checked={showBW} onChange={(v) => { setShowBW(v); handleUpdateSetting(v, 'onyx_show_bw', 'show_body_weight'); }} />
        <ToggleRow label="Show Measurements" checked={showMeas} onChange={(v) => { setShowMeas(v); handleUpdateSetting(v, 'onyx_show_meas', 'show_measurements'); }} />
        <ToggleNavRow
          label="Rest Timer"
          subLabel={`Quick-Add: ${timerIncs.map((v) => `${v}s`).join(' · ')}`}
          checked={showTimer}
          onToggle={(v) => { setShowTimer(v); handleUpdateSetting(v, 'onyx_show_timer', 'show_timer'); }}
          onOpen={() => setTimerIncsOpen(true)}
        />
        <ToggleNavRow
          label="Progression Suggestions"
          subLabel={`Step ${progressionStep} ${weightUnit} · Compound ${mechanicDefaults.compound.sets}×${mechanicDefaults.compound.repMin}–${mechanicDefaults.compound.repMax} · Isolation ${mechanicDefaults.isolation.sets}×${mechanicDefaults.isolation.repMin}–${mechanicDefaults.isolation.repMax}`}
          checked={progressionEnabled}
          onToggle={(v) => { setProgressionEnabled(v); handleUpdateSetting(v, 'onyx_progression_enabled', 'progression_enabled'); }}
          onOpen={() => setProgressionSettingsOpen(true)}
        />
      </div>

      <div className="bg-surface border border-border rounded-card overflow-hidden divide-y divide-border mb-3.5">
        <NavRow label="Default Bar Weight" subLabel={`${activeBarWeight} ${weightUnit}`} onClick={() => setBarWeightOpen(true)} />
        <NavRow label="Custom Exercises" subLabel={exerciseCount === null ? '' : `${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'}`} onClick={() => setCustomExOpen(true)} />
        <NavRow label="Manage Routines" subLabel={routineCount === null ? '' : `${routineCount} routine${routineCount === 1 ? '' : 's'}`} onClick={() => setRoutinesOpen(true)} />
        <NavRow label="Export All Data" subLabel="Download a JSON backup" onClick={() => setExportOpen(true)} />
      </div>

      <button onClick={handleLogout} className="w-full py-3.5 rounded-card border border-danger-border text-danger bg-danger-bg font-bold uppercase tracking-widest text-xs hover:bg-danger/10 transition">
        Sign Out
      </button>
      <div className="text-center mt-4"><span className="text-[10px] text-text-faint">ONYX v2.0.0</span></div>

      {profileOpen && <ProfileSheet onClose={() => setProfileOpen(false)} profile={profile} setProfile={setProfile} />}
      {customExOpen && <CustomExercisesSheet onClose={() => { setCustomExOpen(false); getExercises().then((data) => setExerciseCount(data.filter((ex) => !String(ex.id).startsWith('ex_')).length)); }} />}
      {exportOpen && <ExportDataSheet onClose={() => setExportOpen(false)} profile={profile} />}
      {barWeightOpen && (
        <BottomSheet isOpen onClose={() => setBarWeightOpen(false)} title="Default Bar Weight">
          <div className="flex gap-1.5 flex-wrap">
            {barOptions.filter((w) => w > 0).map((w) => (
              <Pill key={w} mono active={activeBarWeight === w} onClick={() => handleUpdateDefaultBarWeight(w)}>
                {w} {weightUnit}
              </Pill>
            ))}
          </div>
        </BottomSheet>
      )}
      {timerIncsOpen && (
        <BottomSheet isOpen onClose={() => setTimerIncsOpen(false)} title="Quick-Add Buttons">
          <MicroLabel muted className="block mb-2">Seconds</MicroLabel>
          <div className="grid grid-cols-3 gap-2">
            {timerIncs.map((val, idx) => (
              <input
                key={idx}
                type="number"
                value={val || ''}
                onChange={(e) => handleTimerChange(idx, e.target.value)}
                className="w-full bg-black border border-border-pill rounded-lg py-1.5 text-white text-center font-mono text-xs outline-none focus:border-accent transition"
                placeholder="0"
              />
            ))}
          </div>
        </BottomSheet>
      )}
      {progressionSettingsOpen && (
        <ProgressionSettingsSheet
          onClose={() => setProgressionSettingsOpen(false)}
          weightUnit={weightUnit}
          progressionStep={progressionStep}
          mechanicDefaults={mechanicDefaults}
          onSave={handleSaveProgressionSettings}
        />
      )}
      {routinesOpen && (
        // The fallback is a plain overlay, not a second <BottomSheet> -- it
        // only needs to look right for the brief moment before the lazy
        // chunk resolves. RoutineManager renders its own BottomSheet once
        // it mounts, and that one instance owns the back-gesture history
        // entry; a fallback BottomSheet would push its own entry first and
        // race the real one's during the swap (mirrors the same async
        // history.back() timing issue the back-gesture handling below has
        // to guard against, just triggered by Suspense instead of
        // StrictMode) -- easiest to just not have a second pusher. It still
        // needs its own dismiss affordances (backdrop/✕/Escape) though --
        // just wired straight to onClose rather than through history, since
        // there's nothing to pop yet.
        <Suspense fallback={<RoutineManagerLoadingFallback onClose={() => setRoutinesOpen(false)} />}>
          <RoutineManager onBack={() => { setRoutinesOpen(false); getRoutines().then((data) => setRoutineCount(data.length)); }} />
        </Suspense>
      )}
    </div>
  );
}

function UnitRow({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="px-3.5 py-3 flex justify-between items-center">
      <span className="text-sm font-bold text-text-secondary">{label}</span>
      <div className="flex gap-1.5">
        {options.map(([v, text]) => (
          <Pill key={v} mono active={value === v} onClick={() => onChange(v)}>{text}</Pill>
        ))}
      </div>
    </div>
  );
}

function MechanicRangeRow({ label, range, onChange }: { label: string; range: MechanicRepRange; onChange: (field: keyof MechanicRepRange, value: string) => void }) {
  return (
    <div>
      <MicroLabel className="text-accent-light block mb-1.5">{label}</MicroLabel>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <input type="number" min="1" value={range.sets || ''} onChange={(e) => onChange('sets', e.target.value)} className="w-full bg-black border border-border-pill rounded-lg py-1.5 text-white text-center font-mono text-xs outline-none focus:border-accent transition" />
          <span className="block text-center text-[9px] text-text-faint uppercase tracking-wide mt-1">Sets</span>
        </div>
        <div>
          <input type="number" min="1" value={range.repMin || ''} onChange={(e) => onChange('repMin', e.target.value)} className="w-full bg-black border border-border-pill rounded-lg py-1.5 text-white text-center font-mono text-xs outline-none focus:border-accent transition" />
          <span className="block text-center text-[9px] text-text-faint uppercase tracking-wide mt-1">Min Reps</span>
        </div>
        <div>
          <input type="number" min="1" value={range.repMax || ''} onChange={(e) => onChange('repMax', e.target.value)} className="w-full bg-black border border-border-pill rounded-lg py-1.5 text-white text-center font-mono text-xs outline-none focus:border-accent transition" />
          <span className="block text-center text-[9px] text-text-faint uppercase tracking-wide mt-1">Max Reps</span>
        </div>
      </div>
    </div>
  );
}

interface ProgressionSettingsSheetProps {
  onClose: () => void;
  weightUnit: string;
  progressionStep: number;
  mechanicDefaults: MechanicRepDefaults;
  onSave: (step: number, defaults: MechanicRepDefaults) => void;
}

// Edits Weight Step + the Compound/Isolation rep ranges as a local draft,
// only committing (via onSave) once Save is tapped and validation passes --
// see handleSaveProgressionSettings in SettingsView for why. Mirrors
// ProfileSheet's draft-state-plus-Save-button shape below rather than the
// old per-keystroke autosave every other row in this file still uses; this
// sheet needs the extra step because repMin/repMax have a cross-field
// constraint that can't be validated one keystroke at a time without
// fighting the user's typing (a value passes through invalid intermediate
// states, e.g. typing "12" over an existing "8" is briefly "1").
function ProgressionSettingsSheet({ onClose, weightUnit, progressionStep, mechanicDefaults, onSave }: ProgressionSettingsSheetProps) {
  const [step, setStep] = useState(progressionStep);
  const [defaults, setDefaults] = useState<MechanicRepDefaults>(mechanicDefaults);
  const [error, setError] = useState('');

  const handleStepChange = (value: string) => {
    const parsed = parseFloat(value);
    setStep(isNaN(parsed) ? 0 : parsed);
    setError('');
  };

  const handleRangeChange = (mechanic: keyof MechanicRepDefaults, field: keyof MechanicRepRange, value: string) => {
    const parsed = parseInt(value);
    const num = isNaN(parsed) ? 0 : parsed;
    setDefaults((prev) => ({ ...prev, [mechanic]: { ...prev[mechanic], [field]: num } }));
    setError('');
  };

  const validate = (): string | null => {
    if (isNaN(step) || step < 0) return 'Weight Step must be 0 or greater.';
    for (const [mechanic, mechanicLabel] of [['compound', 'Compound'], ['isolation', 'Isolation']] as const) {
      const range = defaults[mechanic];
      if (range.sets < 1) return `${mechanicLabel} Sets must be at least 1.`;
      if (range.repMin < 1) return `${mechanicLabel} Min Reps must be at least 1.`;
      if (range.repMax < 1) return `${mechanicLabel} Max Reps must be at least 1.`;
      if (range.repMin > range.repMax) return `${mechanicLabel} Min Reps can't be greater than Max Reps.`;
    }
    return null;
  };

  const handleSave = () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    onSave(step, defaults);
    onClose();
  };

  return (
    <BottomSheet isOpen onClose={onClose} title="Progression Settings" scrollable>
      <MicroLabel muted className="block mb-2">Weight Step ({weightUnit})</MicroLabel>
      <input
        type="number"
        step="0.5"
        min="0"
        value={step || ''}
        onChange={(e) => handleStepChange(e.target.value)}
        className="w-full bg-black border border-border-pill rounded-lg py-1.5 text-white text-center font-mono text-xs outline-none focus:border-accent transition mb-4"
        placeholder="5"
      />

      <MicroLabel muted className="block mb-1.5">Default Rep Ranges</MicroLabel>
      <p className="text-[11px] text-text-muted mb-3">Starting sets/reps used when adding a Compound or Isolation exercise to a routine. Always editable per exercise afterward.</p>
      <div className="space-y-3">
        <MechanicRangeRow label="Compound" range={defaults.compound} onChange={(field, value) => handleRangeChange('compound', field, value)} />
        <MechanicRangeRow label="Isolation" range={defaults.isolation} onChange={(field, value) => handleRangeChange('isolation', field, value)} />
      </div>

      {error && <p className="text-danger text-[11px] mt-3">{error}</p>}

      <div className="flex gap-2.5 mt-4">
        <button onClick={onClose} className="flex-1 bg-[#1a1a1e] border border-border-pill text-text-secondary font-bold text-xs uppercase tracking-wide py-2.5 rounded-lg hover:text-white transition">
          Cancel
        </button>
        <button onClick={handleSave} className="flex-1 bg-accent text-white font-extrabold text-xs uppercase tracking-wide py-2.5 rounded-lg hover:bg-accent-light transition">
          Save
        </button>
      </div>
    </BottomSheet>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="w-full px-3.5 py-3 flex justify-between items-center">
      <span className="text-sm font-bold text-text-secondary">{label}</span>
      {/* The switch's own onClick is a no-op -- clicks on it still toggle via
          bubbling to this row's button, so it doesn't double-fire against it. */}
      <ToggleSwitch on={checked} onClick={() => {}} />
    </button>
  );
}

function NavRow({ label, subLabel, onClick }: { label: string; subLabel: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full px-3.5 py-3 flex justify-between items-center group hover:bg-black/30 transition">
      <div className="text-left">
        <span className="block text-sm font-bold text-text-secondary">{label}</span>
        {subLabel && <span className="text-[11px] text-text-muted">{subLabel}</span>}
      </div>
      <svg className="w-4 h-4 text-text-muted group-hover:text-white transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
    </button>
  );
}

// Combines a nav row with an inline toggle: tapping the ribbon (label,
// chevron) opens the customize sheet for this setting, while the switch
// itself only flips on/off -- ToggleSwitch's `focusable` mode stops its own
// click/Enter/Space from also bubbling up to the ribbon's onOpen. Replaces
// the old pattern of a second NavRow that only rendered once the toggle was
// on, which pushed the sheet-opening affordance in and out of the list as
// the toggle changed.
//
// The row itself is a role="button" div, not a <button>, so the switch (a
// separately-focusable role="switch") isn't nested inside another
// interactive element -- a real <button> wrapping it would leave keyboard
// users unable to reach the switch at all, since Enter/Space on the outer
// button only ever fires onOpen, never a click event for a nested handler
// to catch.
function ToggleNavRow({ label, subLabel, checked, onToggle, onOpen }: { label: string; subLabel: string; checked: boolean; onToggle: (v: boolean) => void; onOpen: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      className="w-full px-3.5 py-3 flex justify-between items-center group hover:bg-black/30 transition cursor-pointer"
    >
      <div className="text-left min-w-0">
        <span className="block text-sm font-bold text-text-secondary">{label}</span>
        {subLabel && <span className="text-[11px] text-text-muted">{subLabel}</span>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <svg className="w-4 h-4 text-text-muted group-hover:text-white transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
        <ToggleSwitch on={checked} onClick={() => onToggle(!checked)} focusable />
      </div>
    </div>
  );
}

// Shown for the brief window before RoutineManager's lazy chunk resolves.
// Deliberately not a <BottomSheet> (see the call site) -- but still needs
// its own dismiss affordances (backdrop click, ✕, Escape) wired straight
// to onClose, same as every other sheet in the app, just without pushing a
// history entry there's nothing yet to pop.
function RoutineManagerLoadingFallback({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/70 z-[55] flex items-end" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Manage Routines"
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-surface border-t border-border-input rounded-t-[20px] px-5 pt-5 pb-[34px] box-border"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="m-0 font-display font-bold text-base text-white uppercase italic">Manage Routines</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="bg-none border-none text-text-muted text-base cursor-pointer">
            &#10005;
          </button>
        </div>
        <div className="text-center py-10 text-text-muted animate-pulse">Loading...</div>
      </div>
    </div>
  );
}

interface ProfileSheetProps {
  onClose: () => void;
  profile: Profile;
  setProfile: (p: Profile) => void;
}

// Only ever mounted while its sheet is open (see the `profileOpen &&` guard in
// SettingsView) -- state initializes fresh from `profile` on every mount, so there's
// no need for a separate isOpen-driven reset effect.
function ProfileSheet({ onClose, profile, setProfile }: ProfileSheetProps) {
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [emailConfirmOpen, setEmailConfirmOpen] = useState(false);

  const trimmedEmail = email.trim();
  const emailChanged = trimmedEmail !== '' && trimmedEmail.toLowerCase() !== profile.email.toLowerCase();
  const nameChanged = name !== profile.name;

  const performSave = async () => {
    if (password) {
      if (password.length < 6) { setMsg('Error: Password must be at least 6 characters.'); return; }
      if (password !== confirm) { setMsg('Error: Passwords do not match.'); return; }
    }
    if (!nameChanged && !emailChanged && !password) { setMsg('Error: No changes entered.'); return; }

    setLoading(true);
    setMsg('');

    try {
      const parts: string[] = [];

      if (nameChanged) {
        await updateUserSettings({ name: name || null });
        parts.push('Name updated.');
        // Reflected immediately once this write lands, rather than only on
        // full success below -- it already persisted server-side, so the
        // sheet shouldn't keep showing the old name if the auth call after
        // it (email/password) goes on to fail.
        setProfile({ ...profile, name });
      }

      const authAttrs: { password?: string; email?: string } = {};
      if (password) authAttrs.password = password;
      if (emailChanged) authAttrs.email = trimmedEmail;

      if (Object.keys(authAttrs).length > 0) {
        const { error } = await supabase.auth.updateUser(authAttrs);
        if (error) { setMsg('Error: ' + error.message); return; }
        if (authAttrs.password) parts.push('Password updated.');
        if (authAttrs.email) parts.push('Check both emails (old & new) to confirm the change.');
      }

      setMsg('Success! ' + parts.join(' '));
      setPassword('');
      setConfirm('');
      setShowPasswordFields(false);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = () => {
    if (emailChanged) {
      setEmailConfirmOpen(true);
      return;
    }
    performSave();
  };

  return (
    <BottomSheet isOpen onClose={onClose} title="Profile" scrollable>
      <ConfirmModal
        isOpen={emailConfirmOpen}
        title="Change Email?"
        message={`You're about to change your email to ${trimmedEmail}. You'll need to confirm this from a link sent to both your old and new email addresses. Continue?`}
        onConfirm={performSave}
        onClose={() => setEmailConfirmOpen(false)}
      />

      <div className="w-16 h-16 rounded-pill bg-[#1e3a5f] text-accent-light font-display font-bold text-xl flex items-center justify-center mx-auto mb-4">
        {getInitials(name, profile.email)}
      </div>

      <MicroLabel muted className="block mb-1.5">Name</MicroLabel>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full bg-black border border-border-pill rounded-lg px-2.5 py-2 text-white text-[13px] outline-none focus:border-accent transition mb-3.5" />

      <MicroLabel muted className="block mb-1.5">Email</MicroLabel>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={profile.email} className="w-full bg-black border border-border-pill rounded-lg px-2.5 py-2 text-white text-[13px] outline-none focus:border-accent transition mb-3.5" />

      <div className="w-full h-px bg-border mb-3.5"></div>

      <div className="flex justify-between items-center mb-3.5">
        <span className="text-sm font-bold text-text-secondary">Password</span>
        <button type="button" onClick={() => setShowPasswordFields(v => !v)} className="bg-none border-none text-accent-light text-[13px] font-bold cursor-pointer p-0">
          {showPasswordFields ? 'Cancel' : 'Change Password'}
        </button>
      </div>

      {showPasswordFields && (
        <>
          <MicroLabel muted className="block mb-1.5">New Password</MicroLabel>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black border border-border-pill rounded-lg px-2.5 py-2 text-white text-[13px] outline-none focus:border-accent transition mb-3.5" />

          <MicroLabel muted className="block mb-1.5">Confirm Password</MicroLabel>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full bg-black border border-border-pill rounded-lg px-2.5 py-2 text-white text-[13px] outline-none focus:border-accent transition mb-4" />
        </>
      )}

      <div className="flex gap-2.5">
        <button onClick={onClose} className="flex-1 bg-[#1a1a1e] border border-border-pill text-text-secondary font-bold text-xs uppercase tracking-wide py-2.5 rounded-lg hover:text-white transition">
          Cancel
        </button>
        <button onClick={handleUpdate} disabled={loading} className="flex-1 bg-accent text-white font-extrabold text-xs uppercase tracking-wide py-2.5 rounded-lg hover:bg-accent-light transition disabled:opacity-60">
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>

      {msg && (
        <div className={`mt-3 p-2.5 text-xs rounded-lg border text-center ${msg.startsWith('Success') ? 'bg-success-bg text-success border-success-border' : 'bg-danger-bg text-danger border-danger-border'}`}>
          {msg}
        </div>
      )}
    </BottomSheet>
  );
}

// Only ever mounted while its sheet is open -- loads on mount rather than
// watching an isOpen prop.
function CustomExercisesSheet({ onClose }: { onClose: () => void }) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  // null (unclassified) is a valid choice -- falls back to RoutineManager's
  // fixed 3x10 default same as any exercise created without a mechanic.
  const [newMechanic, setNewMechanic] = useState<Exercise['mechanic']>(null);
  const [modalConfig, setModalConfig] = useState<ModalConfig>({ isOpen: false, title: '', message: '', onConfirm: null, isDestructive: false });

  const loadData = async () => {
    setLoading(true);
    const data = await getExercises();
    setExercises(data);
    setLoading(false);
  };

  useEffect(() => {
    // `loading` already starts true, so the initial load writes no state synchronously.
    getExercises().then((data) => {
      setExercises(data);
      setLoading(false);
    });
  }, []);

  const handleAdd = async () => {
    if (!newName) return;
    await addExercise(newName, newMechanic);
    setNewName('');
    setNewMechanic(null);
    loadData();
  };

  const handleDelete = (id: string | number) => {
    setModalConfig({
      isOpen: true,
      title: "Delete Exercise?",
      message: "Are you sure? This will remove it from your selection lists.",
      onConfirm: async () => {
        await deleteCustomExercise(id);
        loadData();
      },
      isDestructive: true
    });
  };

  const isCustom = (id: string | number) => !String(id).startsWith('ex_');
  const customExercises = exercises.filter((ex) => isCustom(ex.id));

  return (
    <BottomSheet isOpen onClose={onClose} title="Custom Exercises" scrollable>
      <ConfirmModal {...modalConfig} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} />

      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          className="flex-1 min-w-0 bg-black border border-border-pill rounded-lg px-2.5 py-2 text-white text-[13px] outline-none focus:border-accent transition"
          placeholder="Exercise name"
        />
        <button onClick={handleAdd} className="bg-accent text-white font-extrabold text-xs uppercase tracking-wide px-4 rounded-lg hover:bg-accent-light transition">Add</button>
      </div>
      <div className="flex items-center gap-1.5 mb-4">
        <MicroLabel muted>Type</MicroLabel>
        <Pill mono active={newMechanic === 'compound'} onClick={() => setNewMechanic(m => m === 'compound' ? null : 'compound')}>Compound</Pill>
        <Pill mono active={newMechanic === 'isolation'} onClick={() => setNewMechanic(m => m === 'isolation' ? null : 'isolation')}>Isolation</Pill>
      </div>

      <div className="space-y-1.5">
        {loading ? (
          <div className="text-center text-text-muted text-sm py-4">Loading...</div>
        ) : customExercises.length === 0 ? (
          <div className="text-center text-text-muted text-sm italic py-4">No custom exercises added yet.</div>
        ) : (
          customExercises.map((ex) => (
            <div key={ex.id} className="flex justify-between items-center bg-black/30 border border-border px-3 py-2.5 rounded-lg">
              <div className="min-w-0">
                <span className="block text-sm font-bold text-text-secondary truncate">{ex.name}</span>
                {ex.mechanic && <span className="text-[10px] text-text-faint uppercase tracking-wide">{ex.mechanic}</span>}
              </div>
              <button onClick={() => handleDelete(ex.id)} className="text-text-faint hover:text-danger text-sm px-1">&#10005;</button>
            </div>
          ))
        )}
      </div>
    </BottomSheet>
  );
}

// Only ever mounted while its sheet is open, so exportedMsg naturally starts
// false on every open without an isOpen-driven reset effect.
function ExportDataSheet({ onClose, profile }: { onClose: () => void; profile: Profile }) {
  const [exporting, setExporting] = useState(false);
  const [exportedMsg, setExportedMsg] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    const [routines, logs, cardioLogs, bodyWeights, circumferences] = await Promise.all([
      getRoutines(),
      getLogs(),
      getCardioLogs(),
      getBodyWeights(),
      getCircumferences()
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      profile: { email: profile.email, name: profile.name, memberSince: profile.memberSince },
      routines,
      workoutLogs: logs,
      cardioLogs,
      bodyWeights,
      circumferences
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'onyx_data_export.json';
    a.click();
    URL.revokeObjectURL(url);

    setExporting(false);
    setExportedMsg(true);
    setTimeout(() => setExportedMsg(false), 2200);
  };

  return (
    <BottomSheet isOpen onClose={onClose} title="Export All Data">
      <p className="text-sm text-text-tertiary mb-4">
        Download a single JSON file containing your profile, settings, routines, workout history, body weight, and measurement logs.
      </p>
      <button onClick={handleExport} disabled={exporting} className="w-full bg-accent text-white font-extrabold text-xs uppercase tracking-wide py-2.5 rounded-lg hover:bg-accent-light transition disabled:opacity-60">
        {exporting ? 'Exporting...' : 'Export All Data'}
      </button>
      {exportedMsg && <p className="text-center text-success text-xs font-bold mt-3">Exported onyx_data_export.json &#10003;</p>}
    </BottomSheet>
  );
}
