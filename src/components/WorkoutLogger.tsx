import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { getExercises, addLog, addCardioLog, getLogs } from '../dataManager';
import ConfirmModal from './ConfirmModal';
import PlateCalculator from './PlateCalculator';
import MicroLabel from './ui/MicroLabel';
import SegmentedToggle from './ui/SegmentedToggle';
import Pill from './ui/Pill';
import DatePill from './ui/DatePill';
import type { Exercise, SetEntry } from '../types';

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

type LogMode = 'lifting' | 'cardio';

const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const CARDIO_TYPES = ['Run', 'Walk', 'Cycle', 'Treadmill', 'Stairmaster', 'Rowing', 'Elliptical', 'HIIT', 'Other'];

export default function WorkoutLogger() {
  const [mode, setMode] = useState<LogMode>('lifting');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalConfig, setModalConfig] = useState<ModalConfig>({ isOpen: false, title: '', message: '', onConfirm: () => {}, isDestructive: false });
  const [weightUnit, setWeightUnit] = useState('lbs');
  const [distUnit, setDistUnit] = useState('mi');

  const [showCalc, setShowCalc] = useState(false);
  const [calcInitWeight, setCalcInitWeight] = useState<string | number>('');

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [exerciseId, setExerciseId] = useState<string | number>('');
  const [personalRecords, setPersonalRecords] = useState<Record<string | number, number>>({});
  const [lastSessionData, setLastSessionData] = useState<Record<string | number, PerformanceStat>>({});

  const [date, setDate] = useState(getLocalDate());
  const [sets, setSets] = useState<SetEntry[]>([{ weight: '', reps: '' }]);
  const [showLiftSavedMsg, setShowLiftSavedMsg] = useState(false);

  const [cardioType, setCardioType] = useState('Run');
  const [cardioDuration, setCardioDuration] = useState('');
  const [cardioDistance, setCardioDistance] = useState('');
  const [showCardioSavedMsg, setShowCardioSavedMsg] = useState(false);

  const liftFlashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cardioFlashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedEx, allLogs] = await Promise.all([getExercises(), getLogs()]);
        setExercises(loadedEx);

        const prMap: Record<string | number, number> = {};
        const lastSessionMap: Record<string | number, PerformanceStat> = {};

        loadedEx.forEach(ex => {
          const pastLogs = allLogs.filter(l => String(l.exercise_id || l.exerciseId) === String(ex.id));

          // Sort descending by date
          pastLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          let max = 0;

          // 1. Calculate PR
          pastLogs.forEach(log => {
            if (log.sets && !log.sets[0]?.isSkipped) {
                log.sets.forEach(s => {
                    const w = parseFloat(String(s.weight));
                    if (w > max) max = w;
                });
            }
          });
          prMap[ex.id] = max;

          // 2. Find Last Session Data (First valid log)
          const lastValidLog = pastLogs.find(l => l.sets && !l.sets[0]?.isSkipped);

          if (lastValidLog && lastValidLog.sets.length > 0) {
             // Find the "best" set from that session to use as suggestion
             const bestSet = lastValidLog.sets.reduce((prev, curr) =>
                (parseFloat(String(curr.weight)) || 0) > (parseFloat(String(prev.weight)) || 0) ? curr : prev
             , lastValidLog.sets[0]);

             if (bestSet) {
                 lastSessionMap[ex.id] = {
                     weight: bestSet.weight ?? '',
                     reps: bestSet.reps ?? ''
                 };
             }
          }
        });

        setPersonalRecords(prMap);
        setLastSessionData(lastSessionMap);
      } catch (error) {
        console.error("Error loading logger data", error);
      }
    };
    loadData();

    const loadSettings = () => {
      setWeightUnit((localStorage.getItem('onyx_unit_weight') || 'lbs').toLowerCase());
      setDistUnit((localStorage.getItem('onyx_unit_distance') || 'mi').toLowerCase());
    };
    loadSettings();
    window.addEventListener('storage', loadSettings);
    return () => {
      window.removeEventListener('storage', loadSettings);
      clearTimeout(liftFlashTimer.current);
      clearTimeout(cardioFlashTimer.current);
    };
  }, []);

  const openConfirm = (title: string, message: string, onConfirm: (() => void) | null = null, isDestructive = false) => {
    setModalConfig({ isOpen: true, title, message, onConfirm, isDestructive });
  };

  const openCalculator = (weightVal: string | number) => {
    setCalcInitWeight(weightVal);
    setShowCalc(true);
  };

  const selectedExercise = exercises.find(e => String(e.id) === String(exerciseId));
  const lastSessionForSelected = selectedExercise ? lastSessionData[selectedExercise.id] : undefined;

  const trimmedQuery = exerciseQuery.trim().toLowerCase();
  const exerciseOptions = trimmedQuery
    ? exercises.filter(e => e.name.toLowerCase().includes(trimmedQuery)).slice(0, 6)
    : [];

  const handleSelectExercise = (ex: Exercise) => {
    const suggested = lastSessionData[ex.id];
    setExerciseId(ex.id);
    setExerciseQuery('');
    setSets(suggested ? [{ weight: suggested.weight, reps: suggested.reps }] : [{ weight: '', reps: '' }]);
  };

  const handleClearExercise = () => {
    setExerciseId('');
    setSets([{ weight: '', reps: '' }]);
  };

  // Copies the last set's values instead of adding a blank line
  const handleAddSet = () => {
    const lastSet = sets[sets.length - 1] || { weight: '', reps: '' };
    setSets([...sets, { weight: lastSet.weight, reps: lastSet.reps }]);
  };

  const handleSetChange = (index: number, field: 'weight' | 'reps', value: string) => {
    const newSets = [...sets];
    newSets[index] = { ...newSets[index], [field]: value };
    for (let i = index + 1; i < newSets.length; i++) {
        newSets[i] = { ...newSets[i], [field]: value };
    }
    setSets(newSets);
  };

  const handleRemoveSet = (index: number) => {
    const setToRemove = sets[index];
    // Presence-based, not truthy -- a set with weight/reps of 0 (a legit
    // logged value, not "empty") was previously skipping the confirm since
    // 0 is falsy.
    const hasData = (setToRemove.weight !== undefined && setToRemove.weight !== '') || (setToRemove.reps !== undefined && setToRemove.reps !== '');
    const remove = () => { const newSets = sets.filter((_, i) => i !== index); setSets(newSets); };
    if (hasData) { openConfirm("Remove Set?", "This set has data. Are you sure you want to remove it?", remove, true); } else { remove(); }
  };

  const saveLift = async () => {
    const validSets = sets.filter(s => s.weight && s.reps);
    if (!exerciseId || validSets.length === 0) { openConfirm("Missing Data", "Please select an exercise and enter weight and reps for at least one set."); return; }

    setIsSubmitting(true);
    try {
      const currentMax = Math.max(...validSets.map(s => parseFloat(String(s.weight)) || 0));
      const oldMax = personalRecords[exerciseId] || 0;

      if (currentMax > oldMax && oldMax > 0) {
        const confettiEnabled = localStorage.getItem('onyx_show_confetti') !== 'false';
        if (confettiEnabled) {
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#22c55e', '#ffffff', '#fbbf24']
          });
        }
      }

      await addLog(date, exerciseId, validSets);

      if (currentMax > oldMax) {
        setPersonalRecords(prev => ({ ...prev, [exerciseId]: currentMax }));
      }

      setSets([{ weight: '', reps: '' }]);
      setExerciseId('');
      setExerciseQuery('');
      clearTimeout(liftFlashTimer.current);
      setShowLiftSavedMsg(true);
      liftFlashTimer.current = setTimeout(() => setShowLiftSavedMsg(false), 2200);
    } catch (err) { openConfirm("Error", "Could not save workout. Please try again.", null, true); } finally { setIsSubmitting(false); }
  };

  const saveCardio = async () => {
    if (!cardioDuration) { openConfirm("Missing Data", "Duration is required to log cardio."); return; }
    setIsSubmitting(true);
    try {
      const dist = cardioDistance === '' ? null : cardioDistance;
      await addCardioLog(date, cardioType, cardioDuration, dist);
      setCardioDuration('');
      setCardioDistance('');
      clearTimeout(cardioFlashTimer.current);
      setShowCardioSavedMsg(true);
      cardioFlashTimer.current = setTimeout(() => setShowCardioSavedMsg(false), 2200);
    } catch (err) { openConfirm("Error", "Could not save cardio. Please try again.", null, true); } finally { setIsSubmitting(false); }
  };

  const maxSetWeight = Math.max(0, ...sets.map(s => parseFloat(String(s.weight)) || 0));

  return (
    <div className="w-full max-w-md mx-auto pb-20 overflow-x-hidden">
      <ConfirmModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} onConfirm={modalConfig.onConfirm} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} isDestructive={modalConfig.isDestructive} />

      <PlateCalculator isOpen={showCalc} onClose={() => setShowCalc(false)} initialWeight={calcInitWeight} unit={weightUnit} />

      <h1 className="font-display font-bold italic text-2xl uppercase text-white mt-1.5 mb-3.5">Log Workout</h1>

      <SegmentedToggle
        options={[
          { value: 'lifting', label: 'Lifting', activeBg: '#27272a', activeColor: '#ffffff' },
          { value: 'cardio', label: 'Cardio', activeBg: 'rgba(59,130,246,0.2)', activeColor: '#93c5fd' },
        ]}
        value={mode}
        onChange={setMode}
        className="mb-4"
      />

      {mode === 'lifting' && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <MicroLabel className="text-accent">Entry</MicroLabel>
            <DatePill value={date} onChange={setDate} />
          </div>

          <div className="rounded-card border border-accent/30 bg-accent/5 p-3.5">
            {selectedExercise ? (
              <div className="flex justify-between items-center mb-2.5">
                <span className="font-bold text-[15px] text-white">{selectedExercise.name}</span>
                <button onClick={handleClearExercise} className="bg-none border-none text-accent-light text-[11px] font-bold cursor-pointer p-0">Change</button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={exerciseQuery}
                  onChange={(e) => setExerciseQuery(e.target.value)}
                  placeholder="Search exercise…"
                  className="w-full bg-black border border-border-pill rounded-lg px-2.5 py-2 text-white text-[13px] outline-none focus:border-accent transition mb-2"
                />
                {exerciseOptions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {exerciseOptions.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => handleSelectExercise(opt)}
                        className="bg-[#141416] border border-border-input text-text-secondary text-xs font-semibold px-3 py-1.5 rounded-pill whitespace-nowrap hover:text-white transition"
                      >
                        {opt.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {selectedExercise && (
              <>
                {lastSessionForSelected && (
                  <div className="font-mono text-[10.5px] text-text-muted mb-2.5">
                    Last: {lastSessionForSelected.weight} {weightUnit} &times; {lastSessionForSelected.reps}
                  </div>
                )}

                <div className="space-y-1.5">
                  {sets.map((set, index) => (
                    <div key={index} className="flex items-center gap-1.5">
                      <span className="text-[10px] text-text-faint w-9 flex-shrink-0">Set {index + 1}</span>
                      <input type="number" placeholder={weightUnit} value={set.weight} onChange={(e) => handleSetChange(index, 'weight', e.target.value)} className="flex-1 min-w-0 bg-black border border-border-pill rounded-md px-2 py-1.5 text-white text-center font-mono text-xs outline-none focus:border-accent transition" />
                      <span className="text-border-subtle text-[11px]">&times;</span>
                      <input type="number" placeholder="reps" value={set.reps} onChange={(e) => handleSetChange(index, 'reps', e.target.value)} className="flex-1 min-w-0 bg-black border border-border-pill rounded-md px-2 py-1.5 text-white text-center font-mono text-xs outline-none focus:border-accent transition" />
                      <button onClick={() => handleRemoveSet(index)} className="w-5 text-text-faint hover:text-danger text-sm leading-none flex-shrink-0">&#10005;</button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mt-2">
                  <button onClick={handleAddSet} className="flex-1 bg-[#141416] border border-border-input text-text-tertiary text-[11px] font-bold py-2 rounded-lg hover:text-white transition">+ Set</button>
                  <button onClick={() => openCalculator(maxSetWeight)} className="flex-1 bg-[#141416] border border-border-input text-text-tertiary text-[11px] font-bold py-2 rounded-lg hover:text-white transition flex items-center justify-center gap-1.5">
                    <svg width="13" height="13" viewBox="0 0 24 24" className="flex-shrink-0"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth={2}></circle><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth={2}></circle></svg>
                    Calc Plates
                  </button>
                </div>

                <button onClick={saveLift} disabled={isSubmitting} className="w-full bg-accent text-white font-extrabold text-xs uppercase tracking-wide py-2.5 rounded-lg mt-2.5 hover:bg-accent-light transition disabled:opacity-60">
                  {isSubmitting ? 'Saving...' : 'Log Workout'}
                </button>
              </>
            )}
            {/* Sibling of the selectedExercise block above, not nested inside it --
                a successful save clears exerciseId as part of resetting the form, which
                would otherwise unmount this flash the instant it should appear. */}
            {showLiftSavedMsg && <p className="text-center text-success text-xs font-bold mt-2.5 mb-0">Workout logged &#10003;</p>}
          </div>
        </div>
      )}

      {mode === 'cardio' && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <MicroLabel className="text-accent">Entry</MicroLabel>
            <DatePill value={date} onChange={setDate} />
          </div>

          <div className="rounded-card border border-accent/30 bg-accent/5 p-3.5">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {CARDIO_TYPES.map(t => (
                <Pill key={t} active={cardioType === t} onClick={() => setCardioType(t)}>{t}</Pill>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              <input type="number" value={cardioDuration} onChange={(e) => setCardioDuration(e.target.value)} placeholder="minutes" className="flex-1 min-w-0 bg-black border border-border-pill rounded-lg px-2.5 py-2 text-white font-mono text-[13px] outline-none focus:border-accent transition" />
              <input type="number" value={cardioDistance} onChange={(e) => setCardioDistance(e.target.value)} placeholder={`${distUnit} (opt)`} className="flex-1 min-w-0 bg-black border border-border-pill rounded-lg px-2.5 py-2 text-white font-mono text-[13px] outline-none focus:border-accent transition" />
            </div>
            <button onClick={saveCardio} disabled={isSubmitting} className="w-full bg-accent text-white font-extrabold text-xs uppercase tracking-wide py-2.5 rounded-lg hover:bg-accent-light transition disabled:opacity-60">
              {isSubmitting ? 'Saving...' : 'Log Cardio'}
            </button>
            {showCardioSavedMsg && <p className="text-center text-success text-xs font-bold mt-2.5 mb-0">Cardio logged &#10003;</p>}
          </div>
        </div>
      )}
    </div>
  );
}
