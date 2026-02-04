import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  getRoutines, getExercises, addLog, updateLog, deleteLog, getLogs, 
  getLogsByDate, getCardioLogsByDate, 
  getBodyWeights, addBodyWeight,              
  getCardioLogs, addCardioLog, deleteCardioLog, 
  getCircumferences, addCircumference, deleteCircumference 
} from '../dataManager';
import ConfirmModal from './ConfirmModal'; 
import PlateCalculator from './PlateCalculator'; 

const getDateStr = (dateObj) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function DailyView({ refreshTrigger }) {
  const [loading, setLoading] = useState(true);
  
  // Settings
  const [weightUnit, setWeightUnit] = useState('lbs'); 
  const [measureUnit, setMeasureUnit] = useState('in'); 
  const [distUnit, setDistUnit] = useState('mi'); 
  const [showBW, setShowBW] = useState(true);
  const [showMeas, setShowMeas] = useState(true);

  // Modal & Calc
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, isDestructive: false });
  const [showCalc, setShowCalc] = useState(false);
  const [calcInitWeight, setCalcInitWeight] = useState('');

  // Dates
  const [todayDateStr, setTodayDateStr] = useState(''); 
  const [viewDate, setViewDate] = useState(new Date()); 
  
  // Data
  const [currentRoutine, setCurrentRoutine] = useState(null); 
  const [exercises, setExercises] = useState([]); 
  
  // Inputs & Logs
  const [setInputs, setSetInputs] = useState({});
  const [dailyLogs, setDailyLogs] = useState([]); 
  const [completedIds, setCompletedIds] = useState([]);
  const [expandedIds, setExpandedIds] = useState([]);
  
  // State for Skipped Exercises
  const [skippedIds, setSkippedIds] = useState([]);
  
  // Stats
  const [lastPerformances, setLastPerformances] = useState({});
  const [personalRecords, setPersonalRecords] = useState({}); 

  // Body Stats
  const [viewWeight, setViewWeight] = useState(null); 
  const [weightInput, setWeightInput] = useState('');
  const [viewMeasurements, setViewMeasurements] = useState([]);
  const [measurePart, setMeasurePart] = useState('Waist');
  const [measureValue, setMeasureValue] = useState('');
  
  // Cardio
  const [viewCardioLogs, setViewCardioLogs] = useState([]); 
  const [routineCardio, setRoutineCardio] = useState([]);     

  // States
  const [isAdHocRest, setIsAdHocRest] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false); 

  const CARDIO_TYPES = ['Run', 'Walk', 'Cycle', 'Treadmill', 'Stairmaster', 'Rowing', 'Elliptical', 'HIIT', 'Other'];
  const BODY_PARTS = ['Waist', 'Chest', 'Left Arm', 'Right Arm', 'Left Thigh', 'Right Thigh', 'Calves', 'Neck', 'Shoulders', 'Hips'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    const now = new Date();
    const dateStr = getDateStr(now);
    setTodayDateStr(dateStr);
    
    loadDailyView(viewDate);

    const loadSettings = () => {
        const w = localStorage.getItem('onyx_unit_weight') || 'lbs';
        setWeightUnit(w.toLowerCase());
        const m = localStorage.getItem('onyx_unit_measure') || 'in';
        setMeasureUnit(m.toLowerCase());
        const d = localStorage.getItem('onyx_unit_distance') || 'mi';
        setDistUnit(d.toLowerCase());
        setShowBW(localStorage.getItem('onyx_show_bw') !== 'false');
        setShowMeas(localStorage.getItem('onyx_show_meas') !== 'false');
    };
    loadSettings();
    window.addEventListener('storage', loadSettings);

    const handleSyncComplete = () => {
        console.log("DailyView: Sync complete, reloading data...");
        loadDailyView(viewDate, false); 
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
          loadDailyView(viewDate, false); 
      }
  }, [refreshTrigger]);

  const openConfirm = (title, message, onConfirm, isDestructive = false) => { setModalConfig({ isOpen: true, title, message, onConfirm, isDestructive }); };
  const openCalculator = (weightVal) => { setCalcInitWeight(weightVal); setShowCalc(true); };

  const loadDailyView = async (targetDate, showLoading = true) => {
    try {
        if (showLoading) setLoading(true);
        
        const dateStr = getDateStr(targetDate);
        const dayName = DAYS[targetDate.getDay()];
        
        const restKey = `onyx_rest_${dateStr}`;
        const isRest = localStorage.getItem(restKey) === 'true';
        setIsAdHocRest(isRest);

        // Fetch ALL data including full history
        const [weights, cLogs, daysLogs, routines, allExercises, mData, allLogs] = await Promise.all([
            getBodyWeights(), 
            getCardioLogsByDate(dateStr), 
            getLogsByDate(dateStr),
            getRoutines(),
            getExercises(),
            getCircumferences(),
            getLogs() // Fetch all history
        ]);

        const existingWeight = weights.find(w => w.date === dateStr);
        setViewWeight(existingWeight ? existingWeight.weight : null);
        const daysMeasurements = mData.filter(m => m.date === dateStr);
        setViewMeasurements(daysMeasurements);
        setViewCardioLogs(cLogs);
        setDailyLogs(daysLogs); 
        
        const doneIds = [];
        const skipIds = [];
        
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

        const swapKey = `onyx_swap_${dateStr}`;
        const swappedRoutineId = localStorage.getItem(swapKey);
        let routine = null;
        if (swappedRoutineId) {
            routine = routines.find(r => String(r.id) === String(swappedRoutineId));
            setIsSwapped(!!routine); 
        } 
        if (!routine) {
            routine = routines.find(r => r.day === dayName);
            setIsSwapped(false);
        }
        setCurrentRoutine(routine || null);
        
        if (routine) {
            setRoutineCardio(routine.cardio || []);
            const mergedData = routine.exercises.map(routineEx => {
                const exId = typeof routineEx === 'object' ? routineEx.id : routineEx;
                const targetSets = routineEx.sets || 3; 
                const targetReps = routineEx.reps || 10;
                const fullExercise = allExercises.find(e => String(e.id) === String(exId));
                
                const existingLog = daysLogs.find(l => String(l.exercise_id || l.exerciseId) === String(exId));
                return fullExercise ? { ...fullExercise, targetSets, targetReps, existingLog } : null;
            }).filter(ex => ex);

            // 1. Calculate Stats & Suggestion Map
            const newLastPerf = {};
            const newPRs = {};
            const suggestionMap = {};

            mergedData.forEach(ex => {
                const exLogs = allLogs.filter(l => String(l.exercise_id || l.exerciseId) === String(ex.id));
                
                // PR Calculation
                let maxWeight = 0;
                exLogs.forEach(log => {
                    if(log.sets && !log.sets[0]?.isSkipped) {
                        log.sets.forEach(s => {
                            const w = parseFloat(s.weight);
                            if (w > maxWeight) maxWeight = w;
                        });
                    }
                });
                newPRs[ex.id] = maxWeight;

                // Last Performance & Suggestions
                // Filter for logs strictly BEFORE today
                const pastLogs = exLogs.filter(l => l.date < dateStr && l.sets && !l.sets[0]?.isSkipped);
                pastLogs.sort((a, b) => new Date(b.date) - new Date(a.date));

                if (pastLogs.length > 0) {
                    const lastLog = pastLogs[0];
                    
                    // Stats: Best set from last session
                    const bestSet = lastLog.sets.reduce((p, c) => (Number(c.weight) > Number(p.weight) ? c : p), lastLog.sets[0]);
                    newLastPerf[ex.id] = { weight: bestSet.weight, reps: bestSet.reps };

                    // Suggestion: Max weight from last session
                    const maxLast = Math.max(...lastLog.sets.map(s => parseFloat(s.weight) || 0));
                    if (maxLast > 0) suggestionMap[ex.id] = maxLast;
                }
            });

            setLastPerformances(newLastPerf);
            setPersonalRecords(newPRs);
            setExercises(mergedData);

            // 2. Initialize Inputs with Auto-Population
            setSetInputs(prev => {
                const newInputs = { ...prev };
                mergedData.forEach(ex => {
                    if (!newInputs[ex.id]) {
                        // Use existing log if present (and not skipped)
                        if (ex.existingLog && !ex.existingLog.sets?.[0]?.isSkipped) {
                            newInputs[ex.id] = ex.existingLog.sets.map(s => ({ weight: s.weight, reps: s.reps }));
                        } else {
                            // Otherwise use suggested weight from history
                            const suggestedW = suggestionMap[ex.id] || '';
                            newInputs[ex.id] = Array(parseInt(ex.targetSets)).fill().map(() => ({ 
                                weight: suggestedW, 
                                reps: ex.targetReps 
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
    } finally {
        if (showLoading) setLoading(false);
    }
  };

  const moveExercise = (index, direction, e) => { e.stopPropagation(); if (direction === -1 && index === 0) return; if (direction === 1 && index === exercises.length - 1) return; const newOrder = [...exercises]; const temp = newOrder[index]; newOrder[index] = newOrder[index + direction]; newOrder[index + direction] = temp; setExercises(newOrder); };
  
  const changeDay = (offset) => { 
    const newDate = new Date(viewDate); 
    newDate.setDate(viewDate.getDate() + offset); 
    setViewDate(newDate); 
  };
  
  const jumpToToday = () => { 
    const now = new Date(); 
    setViewDate(now); 
  };

  const handleSwapToToday = () => { if (!currentRoutine) return; openConfirm('Swap Routine?', `Do you want to replace today's workout with ${currentRoutine.name}?`, () => { const now = new Date(); const todayStr = getDateStr(now); localStorage.setItem(`onyx_swap_${todayStr}`, currentRoutine.id); setViewDate(now); }); };
  const handleRevertSchedule = () => { openConfirm('Revert Schedule?', 'This will go back to the original scheduled routine for today.', () => { const dateStr = getDateStr(viewDate); localStorage.removeItem(`onyx_swap_${dateStr}`); loadDailyView(viewDate); }, true); };
  const handleToggleAdHocRest = () => { const dateStr = getDateStr(viewDate); const newState = !isAdHocRest; setIsAdHocRest(newState); if (newState) { localStorage.setItem(`onyx_rest_${dateStr}`, 'true'); } else { localStorage.removeItem(`onyx_rest_${dateStr}`); } };

  const handleSaveWeight = async () => { if (!weightInput) return; const dateStr = getDateStr(viewDate); await addBodyWeight(weightInput, dateStr); setViewWeight(weightInput); };
  const handleSaveMeasurement = async () => { if (!measureValue) { openConfirm("Missing Value", "Please enter a measurement value before saving."); return; } const dateStr = getDateStr(viewDate); await addCircumference(dateStr, measurePart, measureValue); setMeasureValue(''); const mData = await getCircumferences(); const daysMeasurements = mData.filter(m => m.date === dateStr); setViewMeasurements(daysMeasurements); };
  const handleDeleteMeasurement = (id) => { openConfirm('Delete Measurement?', 'Are you sure you want to remove this entry?', async () => { const dateStr = getDateStr(viewDate); await deleteCircumference(id); const mData = await getCircumferences(); const daysMeasurements = mData.filter(m => m.date === dateStr); setViewMeasurements(daysMeasurements); }, true); };
  
  const handleCompletePlannedCardio = async (plannedItem) => { const dateStr = getDateStr(viewDate); const dist = (plannedItem.distance === '' || plannedItem.distance === undefined) ? null : plannedItem.distance; const newLogs = await addCardioLog(dateStr, plannedItem.type, plannedItem.duration, dist); const todaysCardio = newLogs.filter(c => c.date === dateStr); setViewCardioLogs(todaysCardio); };
  const handleDeleteCardio = (id) => { openConfirm('Delete Session?', 'Remove this cardio log from your history?', async () => { const dateStr = getDateStr(viewDate); const newLogs = await deleteCardioLog(id); const todaysCardio = newLogs.filter(c => c.date === dateStr); setViewCardioLogs(todaysCardio); }, true); };

  const handleSetChange = (exId, index, field, value) => { 
    setSetInputs(prev => { 
        const currentSets = [...prev[exId]]; 
        currentSets[index] = { ...currentSets[index], [field]: value }; 
        for (let i = index + 1; i < currentSets.length; i++) {
            currentSets[i] = { ...currentSets[i], [field]: value };
        }
        return { ...prev, [exId]: currentSets }; 
    }); 
  };

  const handleAddSet = (exId) => {
    setSetInputs(prev => {
        const currentSets = prev[exId] || [];
        return { ...prev, [exId]: [...currentSets, { weight: '', reps: '' }] };
    });
  };

  const handleRemoveSet = (exId, index) => {
    setSetInputs(prev => {
        const currentSets = [...prev[exId]];
        currentSets.splice(index, 1);
        return { ...prev, [exId]: currentSets };
    });
  };

  const handleSkipExercise = async (exId) => {
    const strId = String(exId);
    const dateStr = getDateStr(viewDate);
    const existingLog = dailyLogs.find(l => String(l.exercise_id || l.exerciseId) === strId);

    if (skippedIds.includes(strId)) {
        if (existingLog) await deleteLog(existingLog.id);
        setSkippedIds(prev => prev.filter(id => id !== strId));
    } else {
        const skipMarker = [{ isSkipped: true }];
        if (existingLog) await updateLog({ ...existingLog, sets: skipMarker });
        else await addLog(dateStr, exId, skipMarker);
        setExpandedIds(expandedIds.filter(id => id !== strId));
    }
    loadDailyView(viewDate, false);
  };

  const handleLogExercise = async (exId) => {
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
    validSets.forEach(s => { const w = parseFloat(s.weight); if (w > newMax) newMax = w; });

    if (newMax > previousMax && previousMax > 0) {
        const confettiEnabled = localStorage.getItem('onyx_show_confetti') !== 'false';
        if (confettiEnabled) {
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#22c55e', '#ffffff', '#fbbf24'] });
        }
    }

    const existingLog = dailyLogs.find(l => String(l.exercise_id || l.exerciseId) === strId);
    if (existingLog) { await updateLog({ ...existingLog, sets: validSets }); } 
    else { await addLog(dateStr, exId, validSets); }

    loadDailyView(viewDate, false);
  };

  const toggleExpand = (exId) => { const strId = String(exId); if (expandedIds.includes(strId)) { setExpandedIds(expandedIds.filter(id => id !== strId)); } else { setExpandedIds([...expandedIds, strId]); } };

  // Render Helpers
  const viewDateStr = getDateStr(viewDate);
  const isToday = viewDateStr === todayDateStr;
  const dayName = DAYS[viewDate.getDay()];
  const formattedDate = viewDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const isScheduledRest = currentRoutine && currentRoutine.exercises.length === 0 && (!currentRoutine.cardio || currentRoutine.cardio.length === 0);
  const isNoRoutine = !currentRoutine;
  const unplannedCardio = viewCardioLogs.filter(log => !routineCardio.some(plan => plan.type === log.type));

  if (loading) return <div className="text-center pt-20 text-zinc-500 animate-pulse">Loading Onyx...</div>;

  return (
    <div className="w-full max-w-md mx-auto text-white pb-20 overflow-x-hidden">
      <ConfirmModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} onConfirm={modalConfig.onConfirm} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} isDestructive={modalConfig.isDestructive} />
      <PlateCalculator isOpen={showCalc} onClose={() => setShowCalc(false)} initialWeight={calcInitWeight} unit={weightUnit} />

      {/* HEADER */}
      <div className="mb-6 border-b border-zinc-800 pb-4">
        <div className="flex justify-between items-center mb-4 px-1">
            <button onClick={() => changeDay(-1)} className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg></button>
            <div className="text-center flex-1 mx-2"><div className="text-sm text-blue-400 font-bold uppercase tracking-wider flex items-center justify-center gap-2">{formattedDate} {!isToday && (<button onClick={jumpToToday} className="bg-zinc-800 text-[10px] px-2 py-0.5 rounded-full text-zinc-400 border border-zinc-700 hover:text-white whitespace-nowrap">Today</button>)}</div></div>
            <button onClick={() => changeDay(1)} className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg></button>
        </div>
        <div className="flex justify-between items-end px-1">
            <div className="flex-1 min-w-0 pr-2"><h1 className="text-3xl font-black italic uppercase truncate">{isAdHocRest ? 'Rest Day' : (currentRoutine ? currentRoutine.name : 'No Plan')}</h1>{isSwapped && <div className="flex items-center gap-2 mt-1"><span className="text-[10px] text-orange-400 bg-orange-900/20 px-2 py-0.5 rounded border border-orange-900/50">Swapped</span><button onClick={handleRevertSchedule} className="text-[10px] text-zinc-400 hover:text-white underline">Revert</button></div>}</div>
            <div className="flex gap-2 flex-shrink-0">{!isToday && !isNoRoutine && !isScheduledRest && <button onClick={handleSwapToToday} className="text-[10px] bg-blue-900/30 text-blue-300 border border-blue-500/50 px-3 py-1.5 rounded font-bold uppercase hover:bg-blue-900/50">Do This Today</button>}{!isScheduledRest && !isNoRoutine && !isAdHocRest && <button onClick={handleToggleAdHocRest} className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-3 py-1.5 rounded border border-zinc-700 transition">Rest</button>}</div>
        </div>
      </div>

      {/* BODY STATS */}
      <div className="mb-4 space-y-2">
        {showBW && (viewWeight ? (<div className="bg-zinc-900/50 border border-green-900/50 p-3 rounded-lg flex justify-between items-center"><div className="flex items-center gap-3"><div className="bg-green-900/20 text-green-500 p-2 rounded-full"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg></div><div><span className="text-xs text-green-500 font-bold uppercase block">Morning Weight</span><span className="text-white font-bold">{viewWeight} {weightUnit.toLowerCase()}</span></div></div></div>) : (<div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg"><label className="text-xs text-zinc-500 font-bold uppercase block mb-2">Morning Body Weight</label><div className="flex gap-2"><input type="number" placeholder={`0.0 ${weightUnit.toLowerCase()}`} value={weightInput} onChange={(e) => setWeightInput(e.target.value)} className="flex-1 min-w-0 bg-black border border-zinc-700 rounded p-2 text-white outline-none focus:border-blue-500 transition" /><button onClick={handleSaveWeight} className="bg-white text-black font-bold px-4 rounded text-sm hover:bg-gray-200 transition">Save</button></div></div>))}
        {showMeas && (<>{viewMeasurements.map(m => (<div key={m.id} className="bg-zinc-900/50 border border-green-900/50 p-3 rounded-lg flex justify-between items-center"><div className="flex items-center gap-3"><div className="bg-green-900/20 text-green-500 p-2 rounded-full"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg></div><div><span className="text-xs text-green-500 font-bold uppercase block">{m.body_part}</span><span className="text-white font-bold">{m.measurement} <span className="text-[10px] text-zinc-500 font-normal">{measureUnit.toLowerCase()}</span></span></div></div><button onClick={() => handleDeleteMeasurement(m.id)} className="text-zinc-600 hover:text-red-500 px-2">✕</button></div>))}<div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg"><label className="text-xs text-zinc-500 font-bold uppercase block mb-2">Add Measurement</label><div className="flex gap-2 w-full"><div className="flex-1 min-w-0 relative"><select value={measurePart} onChange={(e) => setMeasurePart(e.target.value)} className="w-full h-10 bg-black border border-zinc-700 rounded pl-3 pr-8 text-white text-sm outline-none appearance-none">{BODY_PARTS.map(p => <option key={p} value={p}>{p}</option>)}</select><div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></div></div><div className="flex-1 min-w-0"><input type="number" placeholder={measureUnit.toLowerCase()} value={measureValue} onChange={(e) => setMeasureValue(e.target.value)} className="w-full h-10 bg-black border border-zinc-700 rounded px-3 text-white text-sm outline-none focus:border-blue-500 transition" /></div><button onClick={handleSaveMeasurement} className="h-10 bg-white text-black font-bold px-4 rounded text-sm hover:bg-gray-200 transition">Log</button></div></div></>)}
      </div>

      {/* CARDIO */}
      <div className="mb-8">
        {routineCardio.length > 0 && !isAdHocRest && (<div className="mb-4"><h3 className="text-xs text-blue-400 font-bold uppercase mb-2">Planned Cardio</h3><div className="space-y-2">{routineCardio.map((planned) => { const matchedLog = viewCardioLogs.find(l => l.type === planned.type); const isDone = !!matchedLog; return (<div key={planned.id} className={`p-3 rounded-lg border flex justify-between items-center ${isDone ? 'bg-zinc-900 border-green-900/50 opacity-70' : 'bg-zinc-900 border-blue-900/30'}`}><div className="flex items-center gap-3"><div><span className={`text-xs font-bold uppercase block ${isDone ? 'text-green-500 line-through' : 'text-blue-400'}`}>{planned.type}</span><span className="text-white font-bold text-sm">Target: {planned.duration}m</span></div></div>{isDone ? (<button onClick={() => handleDeleteCardio(matchedLog.id)} className="text-[10px] text-green-600 hover:text-red-500 font-bold uppercase tracking-wider flex items-center gap-1">Done <span className="text-zinc-600 hover:text-red-500">✕</span></button>) : (<button onClick={() => handleCompletePlannedCardio(planned)} className="bg-white text-black font-bold text-xs px-3 py-1.5 rounded hover:bg-gray-200">Log</button>)}</div>); })}</div></div>)}
        {unplannedCardio.length > 0 && (<div className="space-y-2 mb-2"><h3 className="text-xs text-zinc-500 font-bold uppercase mb-1">Additional Cardio</h3>{unplannedCardio.map(cardio => (<div key={cardio.id} className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-lg flex justify-between items-center"><div><span className="text-xs text-zinc-400 font-bold uppercase block">{cardio.type}</span><span className="text-zinc-300 text-sm">{cardio.duration} mins</span></div><button onClick={() => handleDeleteCardio(cardio.id)} className="text-zinc-600 hover:text-red-500 px-2">✕</button></div>))}</div>)}
      </div>

      {/* EXERCISES */}
      {isAdHocRest ? (<div className="flex flex-col items-center justify-center py-20 bg-zinc-900/50 rounded-xl border border-zinc-800"><div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4"><span className="text-3xl">☕</span></div><h2 className="text-2xl font-black italic uppercase text-white mb-2">Taking it Easy</h2><p className="text-zinc-500 text-sm mb-6">Recovery is when the growth happens.</p><button onClick={handleToggleAdHocRest} className="text-xs text-zinc-600 underline hover:text-white">No, I actually want to workout</button></div>) : isScheduledRest ? (<div className="flex flex-col items-center justify-center py-20 bg-zinc-900/50 rounded-xl border border-zinc-800"><div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4"><span className="text-3xl">☕</span></div><h2 className="text-2xl font-black italic uppercase text-white mb-2">Scheduled Rest</h2><p className="text-zinc-500 text-sm mb-6">Enjoy your day off.</p></div>) : isNoRoutine ? (<div className="text-center mt-10 text-gray-500"><p>No routine scheduled for {dayName}.</p><p className="text-xs mt-4">Go to "Settings" to set up a routine.</p></div>) : (
        <div className="space-y-4 mb-8">{exercises.map((ex, idx) => { 
            const strId = String(ex.id); 
            const isComplete = completedIds.includes(strId); 
            const isSkipped = skippedIds.includes(strId); 
            const isExpanded = expandedIds.includes(strId); 
            
            // Show body if expanded OR if (not complete AND not skipped)
            const showBody = isExpanded || (!isComplete && !isSkipped); 
            
            const lastStats = lastPerformances[ex.id]; 
            const currentSets = setInputs[ex.id] || []; 
            let maxLifted = 0; 
            currentSets.forEach(s => { const w = parseFloat(s.weight); if (w > maxLifted) maxLifted = w; }); 
            const prevMax = personalRecords[ex.id] || 0; 
            const isPR = maxLifted > prevMax && prevMax > 0 && isComplete; 

            // Conditional Styling
            let borderClass = 'border-zinc-800';
            let bgClass = 'bg-zinc-900';
            
            if (isComplete) {
                borderClass = 'border-green-900/50';
                bgClass = 'bg-zinc-900';
            } else if (isSkipped) {
                borderClass = 'border-red-900/50';
                bgClass = 'bg-red-900/10';
            }

            return (
                <div key={ex.id} className={`rounded-lg overflow-hidden transition-all duration-300 border ${borderClass} ${bgClass}`}>
                    
                    {/* CARD HEADER */}
                    <div onClick={() => (isComplete || isSkipped) && toggleExpand(ex.id)} className={`p-4 flex justify-between items-center ${isComplete || isSkipped ? 'cursor-pointer select-none' : ''}`}>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className={`font-bold text-lg truncate ${isComplete ? 'text-green-400 line-through' : isSkipped ? 'text-red-400 line-through' : 'text-gray-200'}`}>{ex.name}</h3>
                                {isPR && <span className="bg-yellow-500/20 text-yellow-400 text-[10px] font-black px-2 py-0.5 rounded border border-yellow-500/50 flex items-center gap-1">🏆 PR</span>}
                                {isComplete && !isPR && <span className="bg-green-900 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">Done</span>}
                                {isSkipped && <span className="bg-red-900 text-red-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">Skipped</span>}
                            </div>
                        </div>

                        {/* Expand/Collapse Chevron (Only if done or skipped) */}
                        <div className="text-right flex flex-col items-end gap-2 ml-2 flex-shrink-0">
                            {!isComplete && !isSkipped && (
                                <div className="flex gap-1 mb-1">
                                    <button onClick={(e) => moveExercise(idx, -1, e)} className={`w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition ${idx === 0 ? 'opacity-0 pointer-events-none' : ''}`}><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg></button>
                                    <button onClick={(e) => moveExercise(idx, 1, e)} className={`w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition ${idx === exercises.length - 1 ? 'opacity-0 pointer-events-none' : ''}`}><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></button>
                                </div>
                            )}
                            
                            {(isComplete || isSkipped) ? (
                                <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1">{isExpanded ? 'Hide' : 'Show'} <span className={`text-lg leading-none transition-transform ${isExpanded ? 'rotate-180' : ''}`}>⌄</span></div>
                            ) : (
                                <><div className="mb-1"><span className="text-[10px] text-zinc-500 uppercase font-bold block">GOAL</span><span className="text-sm font-mono text-blue-400 font-bold">{ex.targetSets} x {ex.targetReps}</span></div>{lastStats && <div><span className="text-[10px] text-zinc-500 uppercase font-bold block">LAST</span><span className="text-sm font-mono text-gray-300">{lastStats.weight} {weightUnit.toLowerCase()} x {lastStats.reps}</span></div>}</>
                            )}
                        </div>
                    </div>

                    {/* CARD BODY */}
                    {showBody && (
                        <div className={(isComplete || isSkipped) ? "opacity-50" : ""}>
                            <div className="px-4 pb-4 space-y-3">
                                <div className="flex text-[10px] text-gray-500 uppercase font-bold px-1">
                                    <div className="w-8 text-center">Set</div>
                                    <div className="flex-1 text-center">{weightUnit.toLowerCase()}</div>
                                    <div className="flex-1 text-center">Reps</div>
                                    <div className="w-6"></div> 
                                </div>
                                
                                {setInputs[ex.id]?.map((set, idx) => (
                                    <div key={idx} className="flex gap-3 items-center">
                                        <div className="w-8 text-center text-zinc-600 font-bold text-sm">{idx + 1}</div>
                                        <div className="flex-1 relative">
                                            <input type="number" placeholder="-" value={set.weight} onChange={(e) => handleSetChange(ex.id, idx, 'weight', e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-center outline-none focus:border-blue-500 transition font-mono" />
                                            <button onClick={() => openCalculator(set.weight)} className="absolute right-1 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-blue-400 p-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg></button>
                                        </div>
                                        <div className="flex-1">
                                            <input type="number" placeholder="-" value={set.reps} onChange={(e) => handleSetChange(ex.id, idx, 'reps', e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-center outline-none focus:border-blue-500 transition font-mono" />
                                        </div>
                                        <button onClick={() => handleRemoveSet(ex.id, idx)} className="w-6 text-zinc-600 hover:text-red-500 text-lg leading-none">×</button>
                                    </div>
                                ))}

                                <button onClick={() => handleAddSet(ex.id)} className="w-full text-center py-2 text-xs font-bold text-blue-500/70 hover:text-blue-400 uppercase tracking-widest border border-dashed border-blue-900/30 rounded hover:bg-blue-900/10 transition">
                                    + Add Set
                                </button>
                            </div>

                            {/* Footer Actions */}
                            <div className="p-3 bg-zinc-800/20 border-t border-zinc-800 flex gap-3">
                                <button onClick={() => handleSkipExercise(ex.id)} className="flex-1 bg-zinc-800 text-zinc-400 font-bold py-3 rounded hover:bg-zinc-700 transition tracking-widest text-xs uppercase border border-zinc-700">
                                    {isSkipped ? 'Un-Skip' : 'Skip'}
                                </button>
                                <button onClick={() => handleLogExercise(ex.id)} className="flex-[2] bg-white text-black font-bold py-3 rounded hover:bg-gray-200 transition tracking-widest text-xs uppercase">
                                    {isComplete ? 'Update Log' : 'Complete Exercise'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ); 
        })}</div>
      )}
    </div>
  );
}