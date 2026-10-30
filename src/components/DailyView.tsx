import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  getRoutines, getExercises, addLog, updateLog, deleteLog, getExerciseStats,
  getDailyViewBundle, getCardioLogsByDate, getLastSessionSets,
  addBodyWeight,
  addCardioLog, deleteCardioLog,
  getCircumferencesByDate, addCircumference, deleteCircumference,
  getDailyOverrideState, setDailyOverride, setDailyRest, removeDailyOverride
} from '../dataManager';
import { emitError } from '../lib/toastBus';
import { suggest, DEFAULT_PROGRESSION_CONFIG, type Suggestion } from '../lib/progression';
import ConfirmModal from './ConfirmModal';
import PlateCalculator from './PlateCalculator';
import Card from './ui/Card';
import MicroLabel from './ui/MicroLabel';
import SuccessRow from './ui/SuccessRow';
import StatusBadge from './ui/StatusBadge';
import { LogoMark } from './icons';
import type { Exercise, Routine, WorkoutLog, CardioLog, CardioTemplate, Circumference, SetEntry, ExerciseStat } from '../types';

interface DailyExercise extends Exercise {
  targetSets: string | number;
  targetReps: string | number;
  targetRepMax: string | number;
  existingLog: WorkoutLog | undefined;
}

interface ModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: (() => void) | null;
  isDestructive: boolean;
}

interface PerformanceStat {
  weight: string | number;
  reps: string | number;
}

interface DailyViewProps {
  refreshTrigger?: number;
}

const getDateStr = (dateObj: Date) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function DailyView({ refreshTrigger }: DailyViewProps) {
  const [loading, setLoading] = useState(true);

  // Settings
  const [weightUnit, setWeightUnit] = useState('lbs');
  const [measureUnit, setMeasureUnit] = useState('in');
  const [showBW, setShowBW] = useState(true);
  const [showMeas, setShowMeas] = useState(true);

  // Modal & Calc
  const [modalConfig, setModalConfig] = useState<ModalConfig>({ isOpen: false, title: '', message: '', onConfirm: () => {}, isDestructive: false });
  const [showCalc, setShowCalc] = useState(false);
  const [calcInitWeight, setCalcInitWeight] = useState<string | number>('');
  // Which set's weight input the user last focused, per exercise -- the dedicated
  // Calc Plates button (replacing the old per-set inline icon) needs to know which
  // set to seed the calculator with, since sets can carry different weights
  // (ramp/drop sets aren't uniform across the exercise).
  const [focusedSet, setFocusedSet] = useState<{ exId: string | number; index: number } | null>(null);

  // Routine Selector State
  const [allRoutines, setAllRoutines] = useState<Routine[]>([]);
  const [showRoutineSelector, setShowRoutineSelector] = useState(false);

  // Dates
  const [todayDateStr, setTodayDateStr] = useState('');
  const [viewDate, setViewDate] = useState(new Date());

  // Data
  const [currentRoutine, setCurrentRoutine] = useState<Routine | null>(null);
  const [exercises, setExercises] = useState<DailyExercise[]>([]);

  // Inputs & Logs
  const [setInputs, setSetInputs] = useState<Record<string | number, SetEntry[]>>({});
  const [dailyLogs, setDailyLogs] = useState<WorkoutLog[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  // Snapshot of exercises that hit a new PR this session, taken at the moment
  // of logging (see handleLogExercise) rather than recomputed from
  // personalRecords on every render -- loadDailyView's post-log stats
  // refetch updates personalRecords to include the set that was just saved,
  // which would otherwise make maxLifted === prevMax and silently flip the
  // PR badge to a plain "done" badge right after the toast/confetti fired.
  const [prHitIds, setPrHitIds] = useState<string[]>([]);

  // State for Skipped Exercises
  const [skippedIds, setSkippedIds] = useState<string[]>([]);

  // Stats
  const [lastPerformances, setLastPerformances] = useState<Record<string | number, PerformanceStat>>({});
  const [personalRecords, setPersonalRecords] = useState<Record<string | number, number>>({});

  // Progression suggestions
  const [suggestions, setSuggestions] = useState<Record<string | number, Suggestion>>({});
  const [expandedSuggestionIds, setExpandedSuggestionIds] = useState<string[]>([]);

  // Body Stats
  const [viewWeight, setViewWeight] = useState<string | number | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [viewMeasurements, setViewMeasurements] = useState<Circumference[]>([]);
  const [measurePart, setMeasurePart] = useState('Navel');
  const [measureValue, setMeasureValue] = useState('');

  // Cardio
  const [viewCardioLogs, setViewCardioLogs] = useState<CardioLog[]>([]);
  const [routineCardio, setRoutineCardio] = useState<CardioTemplate[]>([]);

  // States
  const [isAdHocRest, setIsAdHocRest] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);

  const latest = useRef<{ loadDailyView: (d: Date, showLoading?: boolean) => Promise<void>; viewDate: Date }>({ loadDailyView: async () => {}, viewDate });

  const BODY_PARTS = ['Navel', 'Waist', 'Chest', 'Left Arm', 'Right Arm', 'Left Thigh', 'Right Thigh', 'Calves', 'Neck', 'Shoulders', 'Hips'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const openConfirm = (title: string, message: string, onConfirm: (() => void) | null = null, isDestructive = false) => { setModalConfig({ isOpen: true, title, message, onConfirm, isDestructive }); };
  const openCalculator = (weightVal: string | number) => { setCalcInitWeight(weightVal); setShowCalc(true); };

  // One-time, idempotent move of legacy `onyx_rest_<date>` flags into
  // daily_overrides. A local key is removed only once the database holds the
  // outcome (existing row kept, or rest write applied/queued).
  const migrateLegacyRestFlags = async () => {
    try {
        // Skipped offline: without a read of the existing row, a rest write
        // could replace a routine override. It retries on a later mount.
        if (!navigator.onLine) return;
        const prefix = 'onyx_rest_';
        const dates: string[] = [];
        const invalidKeys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(prefix)) continue;
            const suffix = key.slice(prefix.length);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(suffix)) {
                invalidKeys.push(key);
            } else if (localStorage.getItem(key) === 'true') {
                dates.push(suffix);
            }
        }
        invalidKeys.forEach((key) => localStorage.removeItem(key));
        for (const date of dates) {
            const state = await getDailyOverrideState(date);
            // An unknown state could hide a real override: keep the key and retry later.
            if (state.readFailed) continue;
            if (state.routineId || state.isRest) {
                localStorage.removeItem(`${prefix}${date}`);
                continue;
            }
            if (await setDailyRest(date)) localStorage.removeItem(`${prefix}${date}`);
        }
    } catch (e) {
        console.error('Legacy rest migration failed', e);
    }
  };

  const loadDailyView = async (targetDate: Date, showLoading = true) => {
    try {
        if (showLoading) setLoading(true);
        
        const dateStr = getDateStr(targetDate);
        const dayName = DAYS[targetDate.getDay()];
        
        // getDailyViewBundle/getRoutines/getExercises/getDailyOverrideState each
        // fall back to a local cache on failure rather than rejecting (see
        // dataManager.ts), so this Promise.all — and the try/catch around
        // it — is a safety net for genuinely unexpected errors, not the
        // primary way offline is handled here.
        const [bundle, routines, allExercises, overrideState] = await Promise.all([
            getDailyViewBundle(dateStr),
            getRoutines(),
            getExercises(),
            getDailyOverrideState(dateStr)
        ]);
        const dbOverrideId = overrideState.routineId;
        setIsAdHocRest(overrideState.isRest);
        const { weights, cardioLogs: cLogs, logs: daysLogs, measurements: mData } = bundle;

        // STORE ALL ROUTINES FOR DROPDOWN
        setAllRoutines(routines);

        setViewWeight(weights.length > 0 ? weights[0].weight : null);
        setViewMeasurements(mData);
        setViewCardioLogs(cLogs);
        setDailyLogs(daysLogs); 
        
        const doneIds: string[] = [];
        const skipIds: string[] = [];

        daysLogs.forEach(log => {
            const strId = String(log.exercise_id || log.exerciseId);
            if (log.sets && log.sets.length > 0 && log.sets[0].isSkipped === true) {
                skipIds.push(strId);
            } else {
                doneIds.push(strId);
            }
        });

        setCompletedIds(doneIds);
        setSkippedIds(skipIds);

        let routine: Routine | null | undefined = null;
        if (dbOverrideId) {
            routine = routines.find(r => String(r.id) === String(dbOverrideId));
            setIsSwapped(!!routine);
        }
        if (!routine) {
            routine = routines.find(r => r.days.includes(dayName));
            setIsSwapped(false);
        }
        setCurrentRoutine(routine || null);

        if (routine) {
            setRoutineCardio(routine.cardio || []);
            const mergedData = routine.exercises.map(routineEx => {
                const isObj = typeof routineEx === 'object' && routineEx !== null;
                const exId = isObj ? routineEx.id : routineEx;
                const targetSets = (isObj && routineEx.sets) || 3;
                const targetReps = (isObj && routineEx.reps) || 10;
                // Top of the rep range -- omitted on a fixed (non-ranged)
                // target, so it defaults to targetReps and the GOAL display
                // collapses back to today's single-number rendering.
                const targetRepMax = (isObj && routineEx.repMax) || targetReps;
                const fullExercise = allExercises.find(e => String(e.id) === String(exId));

                const existingLog = daysLogs.find(l => String(l.exercise_id || l.exerciseId) === String(exId));
                return fullExercise ? { ...fullExercise, targetSets, targetReps, targetRepMax, existingLog } : null;
            }).filter((ex): ex is DailyExercise => ex !== null);

            // Calculate Stats & Suggestions (server-side aggregation, scoped to this routine's exercises)
            const exIds = mergedData.map(ex => String(ex.id));
            // Read straight from localStorage rather than component state --
            // this runs inside the initial-load effect, before that state's
            // own settings-load has necessarily flowed through a render (same
            // pattern as the settings loaded above), and progression's source of truth is
            // localStorage per CLAUDE.md's settings architecture anyway.
            const progressionEnabled = localStorage.getItem('onyx_progression_enabled') === 'true';
            const progressionStep = parseFloat(localStorage.getItem('onyx_progression_step') || '') || DEFAULT_PROGRESSION_CONFIG.step;
            const progressionConfig = { step: progressionStep, incrementPct: DEFAULT_PROGRESSION_CONFIG.incrementPct };

            const [stats, lastSessions] = await Promise.all([
                getExerciseStats(exIds, dateStr),
                getLastSessionSets(exIds, dateStr)
            ]);
            const statsById: Record<string, ExerciseStat> = {};
            stats.forEach(s => { statsById[s.exercise_id] = s; });

            const newLastPerf: Record<string | number, PerformanceStat> = {};
            const newPRs: Record<string | number, number> = {};
            const lastSessionMap: Record<string | number, PerformanceStat> = {};
            const newSuggestions: Record<string | number, Suggestion> = {};

            mergedData.forEach(ex => {
                const stat = statsById[String(ex.id)];
                newPRs[ex.id] = stat?.pr_weight || 0;

                if (stat?.last_weight != null) {
                    newLastPerf[ex.id] = { weight: stat.last_weight, reps: stat.last_reps ?? '' };
                    lastSessionMap[ex.id] = { weight: stat.last_weight, reps: stat.last_reps ?? '' };
                }

                const targetSetsNum = parseInt(String(ex.targetSets)) || 1;
                const repMin = Number(ex.targetReps) || 0;
                const repMax = Number(ex.targetRepMax) || repMin;
                newSuggestions[ex.id] = suggest(
                    lastSessions[String(ex.id)],
                    { targetSets: targetSetsNum, repMin, repMax },
                    progressionEnabled,
                    progressionConfig
                );
            });

            setLastPerformances(newLastPerf);
            setPersonalRecords(newPRs);
            setSuggestions(newSuggestions);
            setExercises(mergedData);

            // Initialize Inputs with Auto-Population
            setSetInputs(prev => {
                const newInputs = { ...prev };
                mergedData.forEach(ex => {
                    if (!newInputs[ex.id]) {
                        if (ex.existingLog && !ex.existingLog.sets?.[0]?.isSkipped) {
                            newInputs[ex.id] = ex.existingLog.sets.map(s => ({ weight: s.weight, reps: s.reps }));
                        } else {
                            const suggestion = newSuggestions[ex.id];
                            const suggested = lastSessionMap[ex.id];
                            // Gated on progressionEnabled explicitly, not just
                            // suggestion.weight !== null -- suggest()'s
                            // DISABLED branch also sets weight to
                            // topWeight(last.sets), which can legitimately
                            // differ from getExerciseStats' last_weight (e.g.
                            // a session with a warm-up set). Without the
                            // enabled check, a disabled feature would still
                            // silently swap in the getLastSessionSets-derived
                            // value whenever the two data sources disagree.
                            const hasSuggestionHistory = progressionEnabled && suggestion.weight !== null;
                            const defWeight = hasSuggestionHistory ? suggestion.weight! : (suggested ? suggested.weight : '');
                            // suggestion.reps is always sized to the target's
                            // set count (see progression.ts), so its length
                            // doubles as targetSetsNum here without
                            // re-parsing ex.targetSets a second time.
                            newInputs[ex.id] = Array.from({ length: suggestion.reps.length }, (_, i) => ({
                                weight: defWeight,
                                reps: hasSuggestionHistory ? suggestion.reps[i] : (suggested ? suggested.reps : ex.targetReps)
                            }));
                        }
                    }
                });
                return newInputs;
            });

        } else {
            setExercises([]);
            setRoutineCardio([]);
        }
    } catch (error) {
        console.error("Critical Error Loading View:", error);
        emitError("Could not load today's view.");
    } finally {
        if (showLoading) setLoading(false);
    }
  };

  // Effects below call the newest loadDailyView/viewDate through this ref, so
  // they keep their own trigger-only dependency lists (viewDate for the
  // mount/date-change effect, refreshTrigger for the refresh effect).
  useEffect(() => {
    latest.current = { loadDailyView, viewDate };
  });

  useEffect(() => {
    const now = new Date();
    const dateStr = getDateStr(now);
    setTodayDateStr(dateStr);

    // Move any legacy localStorage rest flags into the database first so the
    // initial load reflects them.
    migrateLegacyRestFlags().finally(() => latest.current.loadDailyView(viewDate));

    const loadSettings = () => {
        const w = localStorage.getItem('onyx_unit_weight') || 'lbs';
        setWeightUnit(w.toLowerCase());
        const m = localStorage.getItem('onyx_unit_measure') || 'in';
        setMeasureUnit(m.toLowerCase());
        setShowBW(localStorage.getItem('onyx_show_bw') !== 'false');
        setShowMeas(localStorage.getItem('onyx_show_meas') !== 'false');
    };
    loadSettings();
    window.addEventListener('storage', loadSettings);

    const handleSyncComplete = () => {
        console.log("DailyView: Sync complete, reloading data...");
        latest.current.loadDailyView(viewDate, false); 
    };
    window.addEventListener('onyx-sync-complete', handleSyncComplete);

    return () => {
        window.removeEventListener('storage', loadSettings);
        window.removeEventListener('onyx-sync-complete', handleSyncComplete);
    };
  }, [viewDate]); 

  useEffect(() => {
      if (refreshTrigger) {
          console.log("DailyView: Background refresh triggered.");
          latest.current.loadDailyView(latest.current.viewDate, false);
      }
  }, [refreshTrigger]);

  const changeDay = (offset: number) => {
    const newDate = new Date(viewDate); 
    newDate.setDate(viewDate.getDate() + offset); 
    setViewDate(newDate); 
  };
  
  const jumpToToday = () => { 
    const now = new Date(); 
    setViewDate(now); 
  };

  // Two-way Swap Handler (Swap current view with Today)
  const handleSwapToToday = () => { 
    if (!currentRoutine) return; 
    
    // 1. Setup Dates
    const now = new Date(); 
    const todayStr = getDateStr(now);
    const targetDateStr = getDateStr(viewDate);
    const targetDateFormatted = viewDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    // Guard: Don't swap if we are already looking at today
    if (todayStr === targetDateStr) return;

    openConfirm(
      'Swap Routines?', 
      `This will swap today's schedule with ${currentRoutine.name} (${targetDateFormatted}).`, 
      async () => { 
        setLoading(true);
        try {
            // 2. Fetch fresh data to know what "Today" currently has
            const [allRoutines, todayState] = await Promise.all([
                getRoutines(),
                getDailyOverrideState(todayStr)
            ]);
            // Unknown state for today: abort rather than write over a real override.
            if (todayState.readFailed) throw new Error('Could not read today\'s override');
            const todayOverrideId = todayState.routineId;

            // 3. Determine Today's Routine ID
            let todaysRoutineId: string | number | null = null;
            if (todayOverrideId) {
                todaysRoutineId = todayOverrideId;
            } else if (!todayState.isRest) {
                const todayDayName = DAYS[now.getDay()];
                const defaultRoutine = allRoutines.find(r => r.days.includes(todayDayName));
                if (defaultRoutine) todaysRoutineId = defaultRoutine.id;
            }

            // 4. Identify Target Routine ID
            const targetRoutineId = currentRoutine.id;

            // 5. Execute Swap
            // Step A: Set Today to use the Target Routine
            await setDailyOverride(todayStr, targetRoutineId);

            // Step B: Handle the Target Date
            if (todaysRoutineId) {
                // If Today had a routine (even a planned rest routine), move it to Target Date
                await setDailyOverride(targetDateStr, todaysRoutineId);
            } else {
                // If Today was empty (no routine), FORCE REST on the Target Date
                await setDailyRest(targetDateStr);
            }
            
            // Legacy Cleanup
            localStorage.removeItem(`onyx_swap_${todayStr}`); 
            localStorage.removeItem(`onyx_swap_${targetDateStr}`);
            
            // 6. Navigate to Today
            setViewDate(now); 
            loadDailyView(now);
        } catch (e) {
            console.error("Swap failed", e);
            emitError("Could not swap routine.");
            setLoading(false);
        }
    });
  };

  // NEW: Ad-Hoc Routine Picker
  const handleAdHocOverride = async (routineId: string | number) => {
    setLoading(true);
    const dateStr = getDateStr(viewDate);
    try {
        await setDailyOverride(dateStr, routineId);
        
        // The routine upsert replaces any rest marker on this date.
        setIsAdHocRest(false);
        
        // Remove legacy swaps if any
        localStorage.removeItem(`onyx_swap_${dateStr}`);

        setShowRoutineSelector(false);
        loadDailyView(viewDate);
    } catch (e) {
        console.error("Ad-Hoc override failed", e);
        emitError("Could not set routine override.");
        setLoading(false);
    }
  };

  const handleRevertSchedule = () => { 
    openConfirm('Revert Schedule?', 'This will go back to the original scheduled routine for today.', async () => { 
        const dateStr = getDateStr(viewDate); 
        await removeDailyOverride(dateStr); 
        localStorage.removeItem(`onyx_swap_${dateStr}`);
        loadDailyView(viewDate); 
    }, true); 
  };

  const handleToggleAdHocRest = async () => {
    const dateStr = getDateStr(viewDate);
    const newState = !isAdHocRest;
    setIsAdHocRest(newState);
    const accepted = newState ? await setDailyRest(dateStr) : await removeDailyOverride(dateStr);
    if (!accepted) {
        // The data layer already showed its error toast; undo the optimistic state.
        setIsAdHocRest(!newState);
        return;
    }
    if (!newState) loadDailyView(viewDate);
  };

  const handleSaveWeight = async () => { if (!weightInput) return; const dateStr = getDateStr(viewDate); await addBodyWeight(weightInput, dateStr); setViewWeight(weightInput); };
  // The refetch below can fail even though the write itself succeeded — see
  // dataManager.ts's performWrite, which queues rather than drops a write
  // made while offline. Gate on navigator.onLine (same signal TrendsView
  // uses, and the one the rest of the app already trusts for this — see
  // App.tsx's banner, toastBus's emitError gate) rather than a blind
  // try/catch: a *genuine* online failure should still surface the normal
  // error toast, not silently fabricate an optimistic entry with no
  // indication anything's wrong. Only skip the refetch (which we already
  // know would fail) and apply an optimistic update when actually offline;
  // 'onyx-sync-complete' (dispatched by flushWriteQueue on a real sync)
  // reconciles it with server data once back online.
  const handleSaveMeasurement = async () => { if (!measureValue) { openConfirm("Missing Value", "Please enter a measurement value before saving."); return; } const dateStr = getDateStr(viewDate); const savedPart = measurePart; const savedValue = measureValue; await addCircumference(dateStr, savedPart, savedValue); setMeasureValue(''); if (navigator.onLine) { try { const mData = await getCircumferencesByDate(dateStr); setViewMeasurements(mData); } catch (e) { console.error("Failed to refresh measurements", e); emitError('Saved, but could not refresh measurements.'); } } else { setViewMeasurements(prev => [...prev, { id: `pending-${Date.now()}`, date: dateStr, body_part: savedPart, measurement: savedValue }]); } };
  const handleDeleteMeasurement = (id: string | number) => { openConfirm('Delete Measurement?', 'Are you sure you want to remove this entry?', async () => { const dateStr = getDateStr(viewDate); await deleteCircumference(id); if (navigator.onLine) { try { const mData = await getCircumferencesByDate(dateStr); setViewMeasurements(mData); } catch (e) { console.error("Failed to refresh measurements", e); emitError('Deleted, but could not refresh measurements.'); } } else { setViewMeasurements(prev => prev.filter(m => m.id !== id)); } }, true); };

  // Same reasoning as handleSaveMeasurement/handleDeleteMeasurement above.
  const handleCompletePlannedCardio = async (plannedItem: CardioTemplate) => { const dateStr = getDateStr(viewDate); const dist = (plannedItem.distance === '' || plannedItem.distance === undefined) ? null : plannedItem.distance; await addCardioLog(dateStr, plannedItem.type, plannedItem.duration, dist); if (navigator.onLine) { try { const cData = await getCardioLogsByDate(dateStr); setViewCardioLogs(cData); } catch (e) { console.error("Failed to refresh cardio logs", e); emitError('Saved, but could not refresh cardio logs.'); } } else { setViewCardioLogs(prev => [...prev, { id: `pending-${Date.now()}`, date: dateStr, type: plannedItem.type, duration: plannedItem.duration, distance: dist }]); } };
  const handleDeleteCardio = (id: string | number) => { openConfirm('Delete Session?', 'Remove this cardio log from your history?', async () => { const dateStr = getDateStr(viewDate); await deleteCardioLog(id); if (navigator.onLine) { try { const cData = await getCardioLogsByDate(dateStr); setViewCardioLogs(cData); } catch (e) { console.error("Failed to refresh cardio logs", e); emitError('Deleted, but could not refresh cardio logs.'); } } else { setViewCardioLogs(prev => prev.filter(c => c.id !== id)); } }, true); };

  const handleSetChange = (exId: string | number, index: number, field: 'weight' | 'reps', value: string) => {
    setSetInputs(prev => {
        const currentSets = [...prev[exId]];
        const previousValue = currentSets[index][field];
        currentSets[index] = { ...currentSets[index], [field]: value };
        // Cascade only into later sets that still match the value just
        // replaced -- i.e. never individually edited away from it. Uniform
        // rows (today's behavior) still cascade in full; a per-set rep
        // ladder (12, 12, 10) no longer gets flattened to 12, 12, 12 the
        // moment set 1 is edited, since set 3's 10 doesn't match set 1's old
        // value.
        for (let i = index + 1; i < currentSets.length; i++) {
            if (currentSets[i][field] === previousValue) {
                currentSets[i] = { ...currentSets[i], [field]: value };
            }
        }
        return { ...prev, [exId]: currentSets };
    });
  };

  // Copies the last set's values instead of adding a blank line, same as
  // WorkoutLogger's handleAddSet.
  const handleAddSet = (exId: string | number) => {
    setSetInputs(prev => {
        const currentSets = prev[exId] || [];
        const lastSet = currentSets[currentSets.length - 1] || { weight: '', reps: '' };
        return { ...prev, [exId]: [...currentSets, { weight: lastSet.weight, reps: lastSet.reps }] };
    });
  };

  const handleRemoveSet = (exId: string | number, index: number) => {
    const setToRemove = setInputs[exId]?.[index];
    // Presence-based, not truthy -- a set with weight/reps of 0 (a legit
    // logged value, not "empty") was previously skipping the confirm since
    // 0 is falsy.
    const hasData = !!setToRemove && ((setToRemove.weight !== undefined && setToRemove.weight !== '') || (setToRemove.reps !== undefined && setToRemove.reps !== ''));
    const remove = () => {
        setSetInputs(prev => {
            const currentSets = [...prev[exId]];
            currentSets.splice(index, 1);
            return { ...prev, [exId]: currentSets };
        });
    };
    if (hasData) { openConfirm("Remove Set?", "This set has data. Are you sure you want to remove it?", remove, true); } else { remove(); }
  };

  const handleSkipExercise = async (exId: string | number) => {
    const strId = String(exId);
    const dateStr = getDateStr(viewDate);
    const existingLog = dailyLogs.find(l => String(l.exercise_id || l.exerciseId) === strId);

    if (skippedIds.includes(strId)) {
        setSkippedIds(prev => prev.filter(id => id !== strId));
        if (existingLog) await deleteLog(existingLog.id);
        setPrHitIds(prev => prev.filter(id => id !== strId));
    } else {
        // Optimistic, same as handleLogExercise's completedIds update below
        // — previously this branch relied entirely on the loadDailyView
        // reload afterward to derive skippedIds from freshly-fetched logs,
        // which never reflected an offline skip since the write hadn't
        // synced yet (and, per the regression above, could actively
        // clobber it with stale cached data).
        setSkippedIds(prev => [...prev, strId]);
        setExpandedIds(expandedIds.filter(id => id !== strId));
        const skipMarker = [{ isSkipped: true }];
        if (existingLog) await updateLog({ ...existingLog, sets: skipMarker });
        else await addLog(dateStr, exId, skipMarker);
    }
    // Offline, the write above is safely queued (see dataManager.ts's
    // performWrite) but a reload right now would serve the stale cached
    // bundle from before this write (see getDailyViewBundle) and
    // re-derive completedIds/skippedIds from it — clobbering the
    // optimistic update above back to how it looked before this call.
    // 'onyx-sync-complete' (dispatched once the queued write actually
    // syncs) reloads for real once back online.
    if (navigator.onLine) loadDailyView(viewDate, false);
  };

  const handleLogExercise = async (exId: string | number) => {
    const setsToLog = setInputs[exId];
    if (!setsToLog) return;
    const validSets = setsToLog.filter(s => s.weight !== '');
    if (validSets.length === 0) { openConfirm("Empty Log", "Please enter weight for at least one set.", null, true); return; }

    const dateStr = getDateStr(viewDate);
    const strId = String(exId);

    if (!completedIds.includes(strId)) setCompletedIds([...completedIds, strId]);
    setExpandedIds(expandedIds.filter(id => id !== strId));

    const previousMax = personalRecords[exId] || 0;
    let newMax = 0;
    validSets.forEach(s => { const w = parseFloat(String(s.weight)); if (w > newMax) newMax = w; });

    if (newMax > previousMax && previousMax > 0) {
        const confettiEnabled = localStorage.getItem('onyx_show_confetti') !== 'false';
        if (confettiEnabled) {
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#22c55e', '#ffffff', '#fbbf24'] });
        }
        setPrHitIds(prev => prev.includes(strId) ? prev : [...prev, strId]);
    }

    const existingLog = dailyLogs.find(l => String(l.exercise_id || l.exerciseId) === strId);
    if (existingLog) { await updateLog({ ...existingLog, sets: validSets }); }
    else { await addLog(dateStr, exId, validSets); }

    // Same reasoning as handleSkipExercise above — don't let an offline
    // reload clobber the optimistic completedIds update with stale cached
    // data predating this write.
    if (navigator.onLine) loadDailyView(viewDate, false);
  };

  // Reverts a completed exercise back to pending (distinct from Skip/Un-Skip,
  // which only ever toggles the skipped state) -- deletes its log entirely
  // rather than leaving a stale completed entry the user no longer wants.
  // Deliberately leaves setInputs untouched: it already holds the values the
  // completed log had (or whatever the user had edited them to), so the
  // reopened card keeps showing those numbers to tweak rather than going
  // blank -- important offline, where loadDailyView's own re-suggestion
  // logic won't run to refill them (see the online gate below).
  // Confirmed, same as every other delete in this file (handleDeleteMeasurement,
  // handleDeleteCardio) -- this permanently deletes the exercise's logged sets,
  // and it sits right above the Skip/Complete footer buttons where a mis-tap
  // is easy.
  const handleReopenExercise = (exId: string | number) => {
    const strId = String(exId);
    openConfirm('Reopen Exercise?', 'This will delete the logged sets for this exercise so you can re-enter them.', async () => {
        const existingLog = dailyLogs.find(l => String(l.exercise_id || l.exerciseId) === strId);
        setCompletedIds(prev => prev.filter(id => id !== strId));
        setExpandedIds(prev => prev.filter(id => id !== strId));
        setPrHitIds(prev => prev.filter(id => id !== strId));
        if (existingLog) await deleteLog(existingLog.id);
        // Same reasoning as handleSkipExercise/handleLogExercise above — don't
        // let an offline reload clobber the optimistic reopen with stale cached
        // data predating this delete.
        if (navigator.onLine) loadDailyView(viewDate, false);
    }, true);
  };

  const toggleExpand = (exId: string | number) => { const strId = String(exId); if (expandedIds.includes(strId)) { setExpandedIds(expandedIds.filter(id => id !== strId)); } else { setExpandedIds([...expandedIds, strId]); } };

  const toggleSuggestionExpand = (exId: string | number) => { const strId = String(exId); setExpandedSuggestionIds(prev => prev.includes(strId) ? prev.filter(id => id !== strId) : [...prev, strId]); };

  // Render Helpers
  const viewDateStr = getDateStr(viewDate);
  const isToday = viewDateStr === todayDateStr;
  const dayName = DAYS[viewDate.getDay()];
  const formattedDate = viewDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const isScheduledRest = currentRoutine && currentRoutine.exercises.length === 0 && (!currentRoutine.cardio || currentRoutine.cardio.length === 0);
  const isNoRoutine = !currentRoutine;
  const unplannedCardio = viewCardioLogs.filter(log => !routineCardio.some(plan => plan.type === log.type));

  if (loading) return <div className="text-center pt-20 text-text-muted animate-pulse font-mono text-sm">Loading Onyx...</div>;

  return (
    <div className="w-full max-w-md mx-auto pb-20 overflow-x-hidden">
      <ConfirmModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} onConfirm={modalConfig.onConfirm} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} isDestructive={modalConfig.isDestructive} />
      <PlateCalculator isOpen={showCalc} onClose={() => setShowCalc(false)} initialWeight={calcInitWeight} unit={weightUnit} />

      {/* HEADER */}
      <div className="flex items-center gap-[7px] mb-4">
        <LogoMark size={20} />
        <span className="font-display font-bold text-[13px] text-white tracking-[0.04em]">ONYX</span>
      </div>

      <div className="flex justify-between items-center mb-3.5">
        <button onClick={() => changeDay(-1)} aria-label="Previous day" className="w-7 h-7 flex-shrink-0 rounded-pill bg-[#141416] border border-border-input text-text-muted flex items-center justify-center hover:text-white transition">
          <span className="text-base leading-none">&#8249;</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-bold text-accent uppercase tracking-[0.08em]">{formattedDate}</span>
          {!isToday && (<button onClick={jumpToToday} className="bg-[#141416] text-[9px] font-bold uppercase px-2 py-0.5 rounded-pill text-text-muted border border-border-input hover:text-white whitespace-nowrap">Today</button>)}
        </div>
        <button onClick={() => changeDay(1)} aria-label="Next day" className="w-7 h-7 flex-shrink-0 rounded-pill bg-[#141416] border border-border-input text-text-muted flex items-center justify-center hover:text-white transition">
          <span className="text-base leading-none">&#8250;</span>
        </button>
      </div>

      <div className="flex justify-between items-start mb-3.5 gap-2">
        <div className="flex-1 min-w-0 relative">
          <div onClick={() => setShowRoutineSelector(!showRoutineSelector)} className="flex items-center gap-1.5 cursor-pointer group select-none">
            <h1 className="font-display font-bold italic text-[26px] leading-tight uppercase truncate text-white group-hover:text-accent-light transition pr-1 tracking-tight">
              {isAdHocRest ? 'Rest Day' : (currentRoutine ? currentRoutine.name : 'No Plan')}
            </h1>
            <svg width="16" height="16" viewBox="0 0 24 24" className={`flex-shrink-0 transition-transform ${showRoutineSelector ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" fill="none" stroke="#52525b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"></path></svg>
          </div>

          {showRoutineSelector && (
            <div className="absolute top-full left-0 mt-2 w-[200px] bg-surface border border-border-input rounded-card p-1.5 z-30 shadow-menu">
              <div className="text-[10px] text-text-muted font-bold uppercase px-2 py-1">Select Routine</div>
              <div className="max-h-60 overflow-y-auto">
                {allRoutines.map(r => (
                  <button
                    key={r.id}
                    onClick={() => handleAdHocOverride(r.id)}
                    className="w-full text-left px-2.5 py-2 text-[13px] font-semibold text-text-secondary hover:bg-[#1a1a1e] hover:text-white rounded-lg transition flex justify-between items-center"
                  >
                    <span>{r.name}</span>
                    <span className="text-[10px] text-text-faint uppercase">{r.days.map(d => d.slice(0, 3)).join(', ')}</span>
                  </button>
                ))}
                {allRoutines.length === 0 && <div className="text-text-muted text-xs px-2.5 py-2 italic">No routines found.</div>}
              </div>
            </div>
          )}

          {isSwapped && (
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status="swapped" />
              <button onClick={handleRevertSchedule} className="text-[10px] text-text-muted hover:text-white underline">Revert</button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!isToday && !isNoRoutine && !isScheduledRest && <button onClick={handleSwapToToday} className="text-[9px] font-bold uppercase bg-accent/15 text-accent-light border border-accent/40 px-2.5 py-1.5 rounded-pill whitespace-nowrap hover:bg-accent/25 transition">Do This Today</button>}
          {!isScheduledRest && !isNoRoutine && !isAdHocRest && <button onClick={handleToggleAdHocRest} className="text-[10px] font-bold uppercase bg-[#141416] border border-border-input text-text-tertiary px-3 py-1.5 rounded-pill hover:text-white transition">Rest</button>}
        </div>
      </div>

      {/* BODY STATS */}
      <div className="mb-4 space-y-2">
        {showBW && (viewWeight ? (
          <SuccessRow label="Morning Weight" value={`${viewWeight} ${weightUnit.toLowerCase()}`} />
        ) : (
          <Card alt>
            <MicroLabel className="block mb-1.5">Morning Body Weight</MicroLabel>
            <div className="flex gap-2">
              <input type="number" placeholder={`0.0 ${weightUnit.toLowerCase()}`} value={weightInput} onChange={(e) => setWeightInput(e.target.value)} className="flex-1 min-w-0 bg-black border border-border-pill rounded-lg p-2 text-white font-mono text-[13px] outline-none focus:border-accent transition" />
              <button onClick={handleSaveWeight} className="bg-white text-black font-bold px-4 rounded-lg text-xs hover:bg-gray-200 transition">Save</button>
            </div>
          </Card>
        ))}
        {showMeas && (<>
          {viewMeasurements.map(m => (
            <div key={m.id} className="flex justify-between items-center bg-success-bg border border-success-border rounded-card px-3.5 py-2.5">
              <div>
                <div className="text-[9px] uppercase tracking-wide text-success font-bold">{m.body_part}</div>
                <span className="font-mono text-sm text-white font-semibold">{m.measurement} <span className="text-[10px] text-text-muted font-normal">{measureUnit.toLowerCase()}</span></span>
              </div>
              <button onClick={() => handleDeleteMeasurement(m.id)} className="text-text-faint hover:text-danger px-2">&#10005;</button>
            </div>
          ))}
          <Card alt>
            <MicroLabel className="block mb-1.5">Add Measurement</MicroLabel>
            <div className="flex gap-2 w-full">
              <div className="flex-1 min-w-0 relative">
                <select value={measurePart} onChange={(e) => setMeasurePart(e.target.value)} className="w-full h-10 bg-black border border-border-pill rounded-lg pl-3 pr-8 text-white text-sm outline-none appearance-none">
                  {BODY_PARTS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
                  <svg width="14" height="14" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"></path></svg>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <input type="number" placeholder={measureUnit.toLowerCase()} value={measureValue} onChange={(e) => setMeasureValue(e.target.value)} className="w-full h-10 bg-black border border-border-pill rounded-lg px-3 text-white font-mono text-[13px] outline-none focus:border-accent transition" />
              </div>
              <button onClick={handleSaveMeasurement} className="h-10 bg-white text-black font-bold px-4 rounded-lg text-xs hover:bg-gray-200 transition">Log</button>
            </div>
          </Card>
        </>)}
      </div>

      {/* CARDIO */}
      <div className="mb-8">
        {routineCardio.length > 0 && !isAdHocRest && (
          <div className="mb-4">
            <MicroLabel className="text-accent block mb-2">Planned Cardio</MicroLabel>
            <div className="space-y-2">
              {routineCardio.map((planned) => {
                const matchedLog = viewCardioLogs.find(l => l.type === planned.type);
                const isDone = !!matchedLog;
                return (
                  <div key={planned.id} className={`rounded-card border px-3.5 py-2.5 flex justify-between items-center ${isDone ? 'bg-surface-alt border-success-border opacity-70' : 'bg-accent/5 border-accent/30'}`}>
                    <div>
                      <span className={`text-[9px] font-bold uppercase block ${isDone ? 'text-success line-through' : 'text-accent'}`}>{planned.type}</span>
                      <span className="font-mono text-[13px] text-white font-semibold">Target: {planned.duration}m</span>
                    </div>
                    {isDone ? (
                      <button onClick={() => handleDeleteCardio(matchedLog.id)} className="text-[9px] font-extrabold uppercase tracking-wide bg-green-500/15 text-success border border-green-500/40 px-2 py-0.5 rounded hover:text-danger transition">Done &#10005;</button>
                    ) : (
                      <button onClick={() => handleCompletePlannedCardio(planned)} className="bg-white text-black font-bold text-[11px] px-3 py-1.5 rounded-lg hover:bg-gray-200 transition">Log</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {unplannedCardio.length > 0 && (
          <div className="space-y-2 mb-2">
            <MicroLabel className="block mb-1">Additional Cardio</MicroLabel>
            {unplannedCardio.map(cardio => (
              <div key={cardio.id} className="bg-surface-alt border border-border rounded-card px-3.5 py-2.5 flex justify-between items-center">
                <div>
                  <span className="text-[9px] text-text-muted font-bold uppercase block">{cardio.type}</span>
                  <span className="font-mono text-[13px] text-text-secondary">{cardio.duration} mins</span>
                </div>
                <button onClick={() => handleDeleteCardio(cardio.id)} className="text-text-faint hover:text-danger px-2">&#10005;</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EXERCISES */}
      {isAdHocRest ? (
        <div className="flex flex-col items-center text-center py-[50px] px-5 bg-surface-alt border border-border rounded-2xl">
          <div className="w-[52px] h-[52px] rounded-pill bg-border-subtle flex items-center justify-center mb-3.5 text-[22px]">&#9749;</div>
          <h2 className="font-display font-bold italic text-xl uppercase text-white mb-1.5">Taking It Easy</h2>
          <p className="text-text-muted text-xs mb-4">Recovery is when the growth happens.</p>
          <button onClick={handleToggleAdHocRest} className="text-[11px] text-accent underline hover:text-accent-light transition">No, I want to workout</button>
        </div>
      ) : isScheduledRest ? (
        <div className="flex flex-col items-center text-center py-[50px] px-5 bg-surface-alt border border-border rounded-2xl">
          <div className="w-[52px] h-[52px] rounded-pill bg-border-subtle flex items-center justify-center mb-3.5 text-[22px]">&#9749;</div>
          <h2 className="font-display font-bold italic text-xl uppercase text-white mb-1.5">Scheduled Rest</h2>
          <p className="text-text-muted text-xs">Enjoy your day off.</p>
        </div>
      ) : isNoRoutine ? (
        <div className="text-center mt-10 text-text-muted text-sm">
          <p>No routine scheduled for {dayName}.</p>
          <p className="text-xs mt-4">Go to "Settings" to set up a routine.</p>
        </div>
      ) : (
        <div className="space-y-2.5 mb-8">{exercises.map((ex) => {
            const strId = String(ex.id);
            const isComplete = completedIds.includes(strId);
            const isSkipped = skippedIds.includes(strId);
            const isExpanded = expandedIds.includes(strId);
            const isPending = !isComplete && !isSkipped;

            const lastStats = lastPerformances[ex.id];
            const suggestion = suggestions[ex.id];
            const isPR = isComplete && prHitIds.includes(strId);

            const cardBorder = isComplete ? 'border-success-border' : isSkipped ? 'border-danger-border' : 'border-border';
            const cardBg = isSkipped ? 'bg-danger-bg' : 'bg-surface';
            const nameColor = isComplete ? 'text-success line-through' : isSkipped ? 'text-danger line-through' : 'text-text-secondary';

            const showBody = isExpanded || isPending;

            return (
                <div key={ex.id} className={`rounded-card border p-3.5 ${cardBorder} ${cardBg}`}>
                    <div onClick={() => (isComplete || isSkipped) && toggleExpand(ex.id)} className={`flex justify-between items-start gap-2.5 ${isComplete || isSkipped ? 'cursor-pointer select-none' : ''}`}>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className={`font-bold text-sm truncate min-w-0 flex-1 ${nameColor}`}>{ex.name}</span>
                                {isPR && <StatusBadge status="pr" label="🏆 PR" />}
                                {isComplete && <StatusBadge status="done" />}
                                {isSkipped && <StatusBadge status="skipped" />}
                            </div>
                            {isPending && (
                                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono text-[11px] text-accent font-semibold">Goal: {ex.targetSets} x {String(ex.targetRepMax) !== String(ex.targetReps) ? `${ex.targetReps}-${ex.targetRepMax}` : ex.targetReps}</span>
                                    {lastStats && (
                                        <>
                                            <span className="text-text-faint text-[10px]">&#8226;</span>
                                            <span className="font-mono text-[11px] text-text-muted">Last: {lastStats.weight} {weightUnit.toLowerCase()} x {lastStats.reps}</span>
                                        </>
                                    )}
                                </div>
                            )}
                            {suggestion && suggestion.kind !== 'NO_GUIDANCE' && isPending && (
                                <div className="mt-1.5">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleSuggestionExpand(ex.id); }}
                                        className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wide border ${suggestion.kind === 'ADD_WEIGHT' ? 'bg-green-500/15 text-success border-green-500/40' : 'bg-warning/12 text-warning border-warning/35'}`}
                                    >
                                        {suggestion.kind === 'ADD_WEIGHT' ? `↑ ${suggestion.weight} ${weightUnit.toLowerCase()}` : '+ REPS'}
                                    </button>
                                    {expandedSuggestionIds.includes(strId) && (
                                        <p className="text-[10.5px] text-text-muted mt-1.5 mb-0">
                                            {suggestion.kind === 'ADD_WEIGHT'
                                                ? `${ex.targetSets} of ${ex.targetSets} sets at ${ex.targetRepMax} reps last time — time to add weight`
                                                : `${suggestion.atMax} of ${suggestion.targetSets} sets at ${ex.targetRepMax} reps last time — aim for ${suggestion.reps.join(', ')} today`}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {(isComplete || isSkipped) && (
                            <div className="text-right flex-shrink-0">
                                <span className="text-text-faint text-[10px] font-bold uppercase flex items-center gap-1">
                                    {isExpanded ? 'Hide' : 'Show'}
                                    <span className={`inline-block text-sm leading-none transition-transform ${isExpanded ? 'rotate-180' : ''}`}>&#8964;</span>
                                </span>
                            </div>
                        )}
                    </div>

                    {showBody && (
                        <div className="mt-3">
                            {isPending ? (
                                <>
                                    <div className="space-y-1.5">
                                        {setInputs[ex.id]?.map((set, sIdx) => (
                                            <div key={sIdx} className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-text-faint w-9 flex-shrink-0">Set {sIdx + 1}</span>
                                                <div className="flex-1 min-w-0">
                                                    <input type="number" placeholder={weightUnit.toLowerCase()} value={set.weight} onFocus={() => setFocusedSet({ exId: ex.id, index: sIdx })} onChange={(e) => handleSetChange(ex.id, sIdx, 'weight', e.target.value)} className="w-full bg-black border border-border-pill rounded-md px-2 py-1.5 text-white text-center font-mono text-xs outline-none focus:border-accent transition" />
                                                </div>
                                                <span className="text-border-subtle text-[11px]">&times;</span>
                                                <div className="flex-1 min-w-0">
                                                    <input type="number" placeholder="reps" value={set.reps} onFocus={() => setFocusedSet({ exId: ex.id, index: sIdx })} onChange={(e) => handleSetChange(ex.id, sIdx, 'reps', e.target.value)} className="w-full bg-black border border-border-pill rounded-md px-2 py-1.5 text-white text-center font-mono text-xs outline-none focus:border-accent transition" />
                                                </div>
                                                <button onClick={() => handleRemoveSet(ex.id, sIdx)} className="w-5 text-text-faint hover:text-danger text-sm leading-none flex-shrink-0">&#10005;</button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex gap-2 mt-2">
                                        <button onClick={() => handleAddSet(ex.id)} className="flex-1 text-center py-2 text-[11px] font-bold text-accent/80 hover:text-accent-light uppercase tracking-widest border border-dashed border-accent/30 rounded-lg hover:bg-accent/10 transition">
                                            + Set
                                        </button>
                                        <button onClick={() => { const idx = focusedSet && focusedSet.exId === ex.id ? focusedSet.index : 0; openCalculator(setInputs[ex.id]?.[idx]?.weight ?? ''); }} className="flex-1 flex items-center justify-center gap-1.5 text-center py-2 text-[11px] font-bold text-text-tertiary hover:text-white uppercase tracking-widest border border-border-input rounded-lg hover:bg-[#141416] transition">
                                            <svg width="12" height="12" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth={2}></circle><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth={2}></circle></svg>
                                            Calc Plates
                                        </button>
                                    </div>

                                    <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                                        <button onClick={() => handleLogExercise(ex.id)} className="flex-[2] bg-accent text-white font-extrabold py-2.5 rounded-lg hover:bg-accent-light transition tracking-wide text-[11px] uppercase">
                                            Complete Exercise
                                        </button>
                                        <button onClick={() => handleSkipExercise(ex.id)} className="flex-1 bg-[#141416] border border-border-input text-text-tertiary font-bold py-2.5 rounded-lg hover:text-white transition tracking-wide text-[11px] uppercase">
                                            Skip
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div>
                                    {isComplete && (
                                        <div className="space-y-1.5 mb-2.5">
                                            {setInputs[ex.id]?.map((set, sIdx) => (
                                                <div key={sIdx} className="flex justify-between items-center text-[13px]">
                                                    <span className="text-[10px] text-text-faint">Set {sIdx + 1}</span>
                                                    <span className="font-mono text-text-secondary">{set.weight} {weightUnit.toLowerCase()} &times; {set.reps}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <button onClick={() => isSkipped ? handleSkipExercise(ex.id) : handleReopenExercise(ex.id)} className="block bg-none border-none text-accent-light text-[11px] font-bold underline cursor-pointer p-0">
                                        {isSkipped ? 'Un-Skip' : 'Reopen'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
        })}</div>
      )}
    </div>
  );
}