import React, { useState, useEffect } from 'react';
import { getExercises, getRoutines, saveRoutine, deleteRoutine, addExercise } from '../dataManager';
import ConfirmModal from './ConfirmModal';
import BottomSheet from './ui/BottomSheet';
import MicroLabel from './ui/MicroLabel';
import Pill from './ui/Pill';
import ToggleSwitch from './ui/ToggleSwitch';
import { getMechanicRepDefaults } from '../lib/mechanicDefaults';
import type { Exercise, Routine, CardioTemplate } from '../types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CARDIO_TYPES = ['Run', 'Walk', 'Cycle', 'Treadmill', 'Stairmaster', 'Rowing', 'Elliptical', 'HIIT', 'Other'];

interface SelectedExercise {
  id: string | number;
  name: string;
  targetSets: string | number;
  targetReps: string | number;
  targetRepMax: string | number;
}

interface ModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: (() => void) | null;
  isDestructive: boolean;
}

interface RoutineManagerProps {
  onBack: () => void;
}

type Screen = 'list' | 'detail';

// firstDayIndex sorts a routine by its earliest assigned weekday (Mon-first),
// pushing day-less routines (a freshly quick-added one, before it's been
// assigned any days) to the end rather than lumping them with Monday.
const firstDayIndex = (r: Routine) => r.days.length ? Math.min(...r.days.map(d => DAYS.indexOf(d))) : DAYS.length;

export default function RoutineManager({ onBack }: RoutineManagerProps) {
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('list');
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [newRoutineName, setNewRoutineName] = useState('');

  // --- MODAL STATE ---
  const [modalConfig, setModalConfig] = useState<ModalConfig>({
    isOpen: false, title: '', message: '', onConfirm: () => {}, isDestructive: false
  });

  // --- DETAIL/EDIT STATE ---
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [routineName, setRoutineName] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>([]);
  const [isRestDay, setIsRestDay] = useState(false);
  const [routineCardio, setRoutineCardio] = useState<CardioTemplate[]>([]);
  const [cardioInput, setCardioInput] = useState({ type: 'Run', duration: '', distance: '' });
  const [editingId, setEditingId] = useState<string | number | null>(null);

  // SEARCH-OR-CREATE STATE for adding an exercise to the routine
  const [exerciseQuery, setExerciseQuery] = useState('');
  // Mechanic picked for a brand-new custom exercise, before it's created --
  // null (unclassified) is a valid choice, same as leaving it unset.
  const [newExerciseMechanic, setNewExerciseMechanic] = useState<Exercise['mechanic']>(null);

  // User-configurable default rep range per mechanic (Settings > Default Rep
  // Ranges) -- read from localStorage same as every other onyx_* preference,
  // and refreshed on the same synthetic 'storage' event SettingsView
  // dispatches after a save so this reflects a change without a remount.
  const [mechanicDefaults, setMechanicDefaults] = useState(getMechanicRepDefaults());

  useEffect(() => {
    loadData();
    const loadDefaults = () => setMechanicDefaults(getMechanicRepDefaults());
    window.addEventListener('storage', loadDefaults);
    return () => window.removeEventListener('storage', loadDefaults);
  }, []);

  const openConfirm = (title: string, message: string, onConfirm: (() => void) | null = null, isDestructive = false) => {
    setModalConfig({ isOpen: true, title, message, onConfirm, isDestructive });
  };

  const loadData = async () => {
    setLoading(true);
    const [loadedExercises, loadedRoutines] = await Promise.all([
        getExercises(),
        getRoutines()
    ]);
    setAllExercises(loadedExercises);
    setRoutines(loadedRoutines);
    setLoading(false);
  };

  const trimmedQuery = exerciseQuery.trim();
  const exerciseOptions = trimmedQuery
    ? allExercises
        .filter(ex => ex.name.toLowerCase().includes(trimmedQuery.toLowerCase()))
        .filter(ex => !selectedExercises.some(item => String(item.id) === String(ex.id)))
        .slice(0, 6)
    : [];
  const exactMatchExists = allExercises.some(ex => ex.name.toLowerCase() === trimmedQuery.toLowerCase());

  const toggleExercise = (ex: Exercise) => {
    if (isRestDay) return;
    const isSelected = selectedExercises.find(item => String(item.id) === String(ex.id));
    if (isSelected) {
      setSelectedExercises(selectedExercises.filter(item => String(item.id) !== String(ex.id)));
    } else {
      // mechanic can be null/undefined (unclassified) -- indexing with that
      // just misses, same effect as the explicit fallback path below.
      const defaults = ex.mechanic ? mechanicDefaults[ex.mechanic] : undefined;
      setSelectedExercises([
        ...selectedExercises,
        defaults
          ? { id: ex.id, name: ex.name, targetSets: defaults.sets, targetReps: defaults.repMin, targetRepMax: defaults.repMax }
          // No known mechanic (e.g. a brand-new custom exercise) -- today's
          // fixed 3x10, same as before this feature existed. targetRepMax
          // stays blank rather than mirroring targetReps, so it renders as
          // an empty second input and serializes without the repMax key.
          : { id: ex.id, name: ex.name, targetSets: 3, targetReps: 10, targetRepMax: '' }
      ]);
    }
  };

  const handleSelectExerciseOption = (ex: Exercise) => {
    toggleExercise(ex);
    setExerciseQuery('');
    setNewExerciseMechanic(null);
  };

  const handleCreateExerciseInline = async () => {
    if (!trimmedQuery) return;
    await addExercise(trimmedQuery, newExerciseMechanic);
    const updated = await getExercises();
    setAllExercises(updated);
    const created = updated.find(ex => ex.name.toLowerCase() === trimmedQuery.toLowerCase());
    if (created) toggleExercise(created);
    setExerciseQuery('');
    setNewExerciseMechanic(null);
  };

  const updateTarget = (exId: string | number, field: keyof SelectedExercise, value: string) => {
    setSelectedExercises(prev => prev.map(item => {
      if (String(item.id) === String(exId)) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const removeSelectedExercise = (index: number) => {
    const newList = [...selectedExercises];
    newList.splice(index, 1);
    setSelectedExercises(newList);
  };

  const addCardioToRoutine = () => {
    if (!cardioInput.duration) {
        openConfirm("Missing Duration", "Please set a duration for the cardio session.");
        return;
    }
    const newCardio = {
      id: Date.now(),
      type: cardioInput.type,
      duration: cardioInput.duration,
      distance: cardioInput.distance
    };
    setRoutineCardio([...routineCardio, newCardio]);
    setCardioInput({ type: 'Run', duration: '', distance: '' });
  };

  const removeCardioFromRoutine = (id: string | number) => {
    setRoutineCardio(routineCardio.filter(c => c.id !== id));
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleRestToggle = () => {
    const newState = !isRestDay;
    setIsRestDay(newState);
    if (newState) {
      setRoutineName('Rest Day');
      setSelectedExercises([]);
      setRoutineCardio([]);
    } else {
      setRoutineName('');
    }
  };

  // freshlyCreated is only set right after handleQuickAdd -- a brand-new
  // routine also has 0 exercises/cardio, but auto-detecting it as a Rest Day
  // would stomp the name the user just typed and flip the toggle on before
  // they've had a chance to configure it. Every other call site (clicking an
  // existing routine in the list) omits it, keeping the original
  // emptiness-only detection for real historical data.
  const openDetail = (routine: Routine, opts: { freshlyCreated?: boolean } = {}) => {
    setEditingId(routine.id);
    setSelectedDays(routine.days || []);
    setRoutineCardio(routine.cardio || []);
    setExerciseQuery('');
    setNewExerciseMechanic(null);

    const looksLikeRestDay = (!routine.exercises || routine.exercises.length === 0) && (!routine.cardio || routine.cardio.length === 0);
    if (looksLikeRestDay && !opts.freshlyCreated) {
      setIsRestDay(true);
      setRoutineName('Rest Day');
      setSelectedExercises([]);
    } else {
      setIsRestDay(false);
      setRoutineName(routine.name);

      const hydratedExercises = (routine.exercises || []).map(savedEx => {
        const exId = typeof savedEx === 'object' ? savedEx.id : savedEx;
        const sets = (typeof savedEx === 'object' && savedEx.sets) || 3;
        const reps = (typeof savedEx === 'object' && savedEx.reps) || 10;
        const repMax = (typeof savedEx === 'object' && savedEx.repMax) || '';
        const fullEx = allExercises.find(e => String(e.id) === String(exId));

        if (!fullEx) return null;
        return {
            id: fullEx.id,
            name: fullEx.name,
            targetSets: sets,
            targetReps: reps,
            targetRepMax: repMax
        };
      }).filter((ex): ex is SelectedExercise => ex !== null);

      setSelectedExercises(hydratedExercises);
    }
    setScreen('detail');
  };

  const handleBackToList = () => {
    setScreen('list');
    setEditingId(null);
    setRoutineName('');
    setSelectedExercises([]);
    setRoutineCardio([]);
    setSelectedDays([]);
    setIsRestDay(false);
    setExerciseQuery('');
    setNewExerciseMechanic(null);
  };

  const handleQuickAdd = async () => {
    const name = newRoutineName.trim();
    if (!name) return;
    const result = await saveRoutine({ id: null, days: [], name, exercises: [], cardio: [] });
    setNewRoutineName('');
    await loadData();

    const created = result?.[0];
    if (created?.id) openDetail({ ...created, days: created.days || [], exercises: created.exercises || [], cardio: created.cardio || [] }, { freshlyCreated: true });
  };

  const handleSave = async () => {
    if (!routineName) {
        openConfirm("Missing Name", "Please give your routine a name.");
        return;
    }
    if (!isRestDay && selectedExercises.length === 0 && routineCardio.length === 0) {
      openConfirm("Empty Routine", "Please select exercises, add cardio, or mark this as a Rest Day.");
      return;
    }

    const exercisesToSave = selectedExercises.map(ex => ({
      id: ex.id,
      sets: ex.targetSets,
      reps: ex.targetReps,
      // Omit rather than write null/empty, so old and new routines
      // serialize identically when no range is set.
      repMax: ex.targetRepMax || undefined
    }));

    await saveRoutine({
      id: editingId,
      days: selectedDays,
      name: routineName,
      exercises: exercisesToSave,
      cardio: routineCardio
    });

    await loadData();
    handleBackToList();
  };

  const handleDelete = (id: string | number) => {
    openConfirm(
        "Delete Routine?",
        "Are you sure you want to delete this routine?",
        async () => {
            await deleteRoutine(id);
            if (editingId === id) handleBackToList();
            loadData();
        },
        true
    );
  };

  const sortedRoutines = [...routines].sort((a, b) => firstDayIndex(a) - firstDayIndex(b));

  return (
    <BottomSheet isOpen onClose={onBack} title={screen === 'list' ? 'Manage Routines' : undefined} scrollable>
      <ConfirmModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        isDestructive={modalConfig.isDestructive}
      />

      {loading ? (
        <div className="text-center py-10 text-text-muted animate-pulse">Loading...</div>
      ) : screen === 'list' ? (
        <>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newRoutineName}
              onChange={(e) => setNewRoutineName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAdd(); }}
              placeholder="New routine name"
              className="flex-1 min-w-0 bg-black border border-border-pill rounded-lg px-2.5 py-2 text-white text-[13px] outline-none focus:border-accent transition"
            />
            <button onClick={handleQuickAdd} className="bg-accent text-white font-extrabold text-xs uppercase tracking-wide px-4 rounded-lg hover:bg-accent-light transition">Add</button>
          </div>

          <div className="divide-y divide-border">
            {sortedRoutines.map(routine => {
              const exCount = routine.exercises?.length || 0;
              const dayLabel = routine.days && routine.days.length > 0 ? routine.days.map(d => d.slice(0, 3)).join(', ') : 'Unassigned';
              return (
                <div
                  key={routine.id}
                  onClick={() => openDetail(routine)}
                  className="flex items-center justify-between gap-3 py-3 cursor-pointer group"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-white text-[15px] truncate">{routine.name}</div>
                    <div className="text-[11px] text-text-muted">{exCount} exercise{exCount === 1 ? '' : 's'} &middot; {dayLabel}</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(routine.id); }} aria-label={`Delete ${routine.name}`} className="text-text-faint hover:text-danger px-1 transition">&#10005;</button>
                    <svg className="w-4 h-4 text-text-muted group-hover:text-white transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                  </div>
                </div>
              );
            })}
            {sortedRoutines.length === 0 && <div className="text-center text-text-muted text-sm italic py-6">No routines yet. Add one above.</div>}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <button onClick={handleBackToList} aria-label="Back to routines" className="text-text-muted hover:text-white transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            </button>
            <h3 className="m-0 font-display font-bold text-base text-white uppercase italic truncate px-2">{routineName || 'New Routine'}</h3>
            <button onClick={onBack} aria-label="Close" className="text-text-muted hover:text-white transition">&#10005;</button>
          </div>

          <MicroLabel muted className="block mb-2">Assigned Days</MicroLabel>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {DAYS.map(day => (
              <Pill key={day} active={selectedDays.includes(day)} onClick={() => toggleDay(day)}>
                {day.slice(0, 3).toUpperCase()}
              </Pill>
            ))}
          </div>

          <button onClick={handleRestToggle} className={`w-full flex items-center justify-between gap-3 p-3 rounded-lg mb-4 border transition-colors ${isRestDay ? 'bg-success-bg border-success-border' : 'bg-black border-border-pill'}`}>
            <span className={`text-sm font-bold ${isRestDay ? 'text-success' : 'text-text-tertiary'}`}>Set as Rest Day</span>
            {/* The switch's own onClick is a no-op -- clicks on it still toggle via
                bubbling to this row's button, so it doesn't double-fire against it. */}
            <ToggleSwitch on={isRestDay} onClick={() => {}} />
          </button>

          <div className={isRestDay ? 'opacity-30 pointer-events-none grayscale' : ''}>
            <MicroLabel muted className="block mb-1.5">Routine Name</MicroLabel>
            <input type="text" value={routineName} onChange={(e) => setRoutineName(e.target.value)} placeholder="e.g. Heavy Legs" className="w-full bg-black border border-border-pill rounded-lg px-2.5 py-2 text-white text-[13px] outline-none focus:border-accent transition mb-4" />

            {/* Exercises */}
            <div className="mb-4">
              <MicroLabel className="text-accent-light block mb-2">Exercises</MicroLabel>
              {selectedExercises.length > 0 && (
                <div className="space-y-1.5">
                  {selectedExercises.map((ex, idx) => (
                    <div key={`${ex.id}-${idx}`} className="bg-surface p-2.5 rounded-lg border border-border-input flex items-center justify-between gap-2">
                      <span className="font-bold text-white text-sm min-w-0 truncate flex-1">{ex.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <input type="number" value={ex.targetSets} onChange={(e) => updateTarget(ex.id, 'targetSets', e.target.value)} className="w-10 bg-black border border-border-pill rounded-md p-1 text-xs text-center text-white outline-none focus:border-accent transition" />
                        <span className="text-text-faint text-[10px]">sets</span>
                        <input type="number" value={ex.targetReps} onChange={(e) => updateTarget(ex.id, 'targetReps', e.target.value)} className="w-10 bg-black border border-border-pill rounded-md p-1 text-xs text-center text-white outline-none focus:border-accent transition" />
                        <span className="text-text-faint text-[10px]">&ndash;</span>
                        <input type="number" value={ex.targetRepMax} onChange={(e) => updateTarget(ex.id, 'targetRepMax', e.target.value)} placeholder="&mdash;" className="w-10 bg-black border border-border-pill rounded-md p-1 text-xs text-center text-white outline-none focus:border-accent transition" />
                        <button onClick={() => removeSelectedExercise(idx)} className="text-danger hover:text-danger/70 transition px-1">&#10005;</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <MicroLabel muted className="block mb-1.5">Add Exercise</MicroLabel>
            <input
              type="text"
              value={exerciseQuery}
              // Also clears any picked mechanic -- it was for whatever name
              // was in the box when it was picked, and shouldn't silently
              // carry over to a different not-yet-created name typed next.
              onChange={(e) => { setExerciseQuery(e.target.value); setNewExerciseMechanic(null); }}
              placeholder="Search or create exercise..."
              className="w-full bg-black border border-border-pill rounded-lg px-2.5 py-2 text-white text-[13px] outline-none focus:border-accent transition"
            />
            {exerciseOptions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {exerciseOptions.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectExerciseOption(opt)}
                    className="bg-[#141416] border border-border-input text-text-secondary text-xs font-semibold px-3 py-1.5 rounded-pill whitespace-nowrap hover:text-white transition"
                  >
                    {opt.name}
                  </button>
                ))}
              </div>
            )}
            {trimmedQuery && !exactMatchExists && (
              <div className="mt-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <MicroLabel muted>Type</MicroLabel>
                  <Pill mono active={newExerciseMechanic === 'compound'} onClick={() => setNewExerciseMechanic(m => m === 'compound' ? null : 'compound')}>Compound</Pill>
                  <Pill mono active={newExerciseMechanic === 'isolation'} onClick={() => setNewExerciseMechanic(m => m === 'isolation' ? null : 'isolation')}>Isolation</Pill>
                </div>
                <button onClick={handleCreateExerciseInline} className="w-full border border-dashed border-accent/40 text-accent-light text-[11px] font-bold py-2 rounded-lg hover:bg-accent/10 transition">
                  + Create "{trimmedQuery}" as new exercise
                </button>
              </div>
            )}

            {/* Planned Cardio */}
            <div className="mt-5 p-3.5 bg-accent/5 border border-accent/30 rounded-card">
              <MicroLabel className="text-accent-light block mb-2">Planned Cardio</MicroLabel>
              {routineCardio.length > 0 && (
                  <div className="space-y-2 mb-3">
                      {routineCardio.map(c => (
                          <div key={c.id} className="flex justify-between items-center bg-black/30 p-2 rounded-lg border border-accent/20">
                              <span className="text-sm font-bold text-text-secondary">{c.type} <span className="text-text-muted font-normal">({c.duration}m)</span></span>
                              <button onClick={() => removeCardioFromRoutine(c.id)} className="text-danger hover:text-danger/70 transition text-xs">&#10005;</button>
                          </div>
                      ))}
                  </div>
              )}
              <div className="flex flex-wrap gap-1.5 mb-2">
                  {CARDIO_TYPES.map(t => (
                    <Pill key={t} active={cardioInput.type === t} onClick={() => setCardioInput({ ...cardioInput, type: t })}>{t}</Pill>
                  ))}
              </div>
              <div className="flex gap-2">
                  <input type="number" placeholder="Min" value={cardioInput.duration} onChange={(e) => setCardioInput({...cardioInput, duration: e.target.value})} className="flex-1 min-w-0 bg-black border border-border-pill rounded-lg px-2.5 py-2 text-white font-mono text-xs outline-none focus:border-accent transition" />
                  <button onClick={addCardioToRoutine} className="bg-accent text-white font-extrabold px-4 rounded-lg text-xs uppercase tracking-wide hover:bg-accent-light transition">+</button>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-5">
              <button onClick={handleBackToList} className="flex-1 bg-[#141416] border border-border-input text-text-tertiary font-bold py-3 rounded-lg hover:text-white transition uppercase tracking-widest text-xs">Cancel</button>
              <button onClick={handleSave} className="flex-[2] bg-accent-light text-black font-extrabold py-3 rounded-lg transition uppercase tracking-widest text-xs hover:bg-accent">Save</button>
          </div>
        </>
      )}
    </BottomSheet>
  );
}
