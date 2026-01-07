import React, { useState, useEffect } from 'react';
import { 
  getRoutines, getExercises, addLog, getLogs, // Lifting
  getBodyWeights, addBodyWeight,              // Body Weight
  getCardioLogs, addCardioLog, deleteCardioLog // Cardio
} from '../dataManager';

export default function DailyView() {
  // --- DATES & NAVIGATION ---
  const [todayDateStr, setTodayDateStr] = useState(''); 
  const [viewDate, setViewDate] = useState(new Date()); 
  
  // --- DATA STATE ---
  const [currentRoutine, setCurrentRoutine] = useState(null); 
  const [exercises, setExercises] = useState([]); 
  
  // --- INPUT STATES ---
  const [setInputs, setSetInputs] = useState({});
  const [completedIds, setCompletedIds] = useState([]);
  const [expandedIds, setExpandedIds] = useState([]);
  const [lastPerformances, setLastPerformances] = useState({});

  // --- BODY WEIGHT ---
  const [viewWeight, setViewWeight] = useState(null); 
  const [weightInput, setWeightInput] = useState('');

  // --- CARDIO ---
  const [viewCardioLogs, setViewCardioLogs] = useState([]); 
  const [routineCardio, setRoutineCardio] = useState([]);     
  
  // Cardio Form
  const [cardioType, setCardioType] = useState('Run');
  const [cardioDuration, setCardioDuration] = useState(''); 
  const [cardioDistance, setCardioDistance] = useState(''); 
  const [showCardioForm, setShowCardioForm] = useState(false);

  // --- REST DAY ---
  const [isAdHocRest, setIsAdHocRest] = useState(false);

  // --- SWAP STATE ---
  const [isSwapped, setIsSwapped] = useState(false); 

  const CARDIO_TYPES = ['Run', 'Walk', 'Cycle', 'Treadmill', 'Stairmaster', 'Rowing', 'Elliptical', 'HIIT', 'Other'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    setTodayDateStr(dateStr);
    loadView(now);
  }, []);

  const getDateStr = (dateObj) => dateObj.toISOString().split('T')[0];

  // --- CORE DATA LOADER ---
  const loadView = (targetDate) => {
    const dateStr = getDateStr(targetDate);
    const dayName = DAYS[targetDate.getDay()];
    
    // 1. Check Rest
    const restKey = `onyx_rest_${dateStr}`;
    const isRest = localStorage.getItem(restKey) === 'true';
    setIsAdHocRest(isRest);

    // 2. Load Weight
    const weights = getBodyWeights();
    const existingWeight = weights.find(w => w.date === dateStr);
    setViewWeight(existingWeight ? existingWeight.weight : null);

    // 3. Load Logs
    const cLogs = getCardioLogs();
    const daysCardio = cLogs.filter(c => c.date === dateStr);
    setViewCardioLogs(daysCardio);

    const allLogs = getLogs();
    const daysLogs = allLogs.filter(log => log.date === dateStr);
    const doneIds = daysLogs.map(log => String(log.exerciseId));
    setCompletedIds(doneIds);

    // 4. DETERMINE ROUTINE (Handle Swaps)
    const swapKey = `onyx_swap_${dateStr}`;
    const swappedRoutineId = localStorage.getItem(swapKey);
    const routines = getRoutines();
    
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

      const allExercises = getExercises();
      const mergedData = routine.exercises.map(routineEx => {
        const exId = typeof routineEx === 'object' ? routineEx.id : routineEx;
        const targetSets = routineEx.sets || 3; 
        const targetReps = routineEx.reps || 10;
        const fullExercise = allExercises.find(e => String(e.id) === String(exId));
        return { ...fullExercise, targetSets, targetReps };
      }).filter(ex => ex && ex.name);

      setExercises(mergedData);

      const initialInputs = {};
      mergedData.forEach(ex => {
        initialInputs[ex.id] = Array(parseInt(ex.targetSets)).fill().map(() => ({
          weight: '',
          reps: ex.targetReps
        }));
      });
      setSetInputs(initialInputs);

      // History Stats
      const historyStats = {};
      mergedData.forEach(ex => {
        const pastLogs = allLogs.filter(l => 
           String(l.exerciseId) === String(ex.id) && 
           new Date(l.date) < new Date(dateStr) 
        );
        if (pastLogs.length > 0) {
          pastLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
          const lastLog = pastLogs[0]; 
          if (lastLog.sets && lastLog.sets.length > 0) {
            const bestSet = lastLog.sets.reduce((prev, current) => 
              (Number(current.weight) > Number(prev.weight) ? current : prev)
            , lastLog.sets[0]);
            historyStats[ex.id] = `${bestSet.weight} lbs x ${bestSet.reps}`;
          }
        }
      });
      setLastPerformances(historyStats);
    } else {
      setExercises([]);
      setRoutineCardio([]);
    }
  };

  // --- NAVIGATION HANDLERS ---

  const changeDay = (offset) => {
    const newDate = new Date(viewDate);
    newDate.setDate(viewDate.getDate() + offset);
    setViewDate(newDate);
    loadView(newDate);
  };

  const jumpToToday = () => {
    const now = new Date();
    setViewDate(now);
    loadView(now);
  };

  // 1. SAVE THE SWAP
  const handleSwapToToday = () => {
    if (!currentRoutine) return;
    
    const confirmMsg = `Replace today's workout with ${currentRoutine.name}?`;
    if (window.confirm(confirmMsg)) {
        const now = new Date();
        const todayStr = getDateStr(now);
        localStorage.setItem(`onyx_swap_${todayStr}`, currentRoutine.id);
        setViewDate(now);
        loadView(now);
    }
  };

  // 2. REVERT THE SWAP
  const handleRevertSchedule = () => {
    if (window.confirm("Revert to the original scheduled routine?")) {
        const dateStr = getDateStr(viewDate);
        localStorage.removeItem(`onyx_swap_${dateStr}`);
        loadView(viewDate);
    }
  };

  // --- ACTIONS ---

  const handleToggleAdHocRest = () => {
    const dateStr = getDateStr(viewDate);
    const newState = !isAdHocRest;
    setIsAdHocRest(newState);
    if (newState) {
      localStorage.setItem(`onyx_rest_${dateStr}`, 'true');
    } else {
      localStorage.removeItem(`onyx_rest_${dateStr}`);
    }
  };

  const handleSaveWeight = () => {
    if (!weightInput) return;
    const dateStr = getDateStr(viewDate);
    addBodyWeight(weightInput, dateStr);
    setViewWeight(weightInput);
  };

  const handleSaveCardio = () => {
    if (!cardioDuration) return alert("Duration is required");
    const dateStr = getDateStr(viewDate);
    const newLogs = addCardioLog(dateStr, cardioType, cardioDuration, cardioDistance);
    const todaysCardio = newLogs.filter(c => c.date === dateStr);
    setViewCardioLogs(todaysCardio);
    setCardioDuration('');
    setCardioDistance('');
    setShowCardioForm(false);
  };

  const handleCompletePlannedCardio = (plannedItem) => {
    const dateStr = getDateStr(viewDate);
    const newLogs = addCardioLog(dateStr, plannedItem.type, plannedItem.duration, plannedItem.distance);
    const todaysCardio = newLogs.filter(c => c.date === dateStr);
    setViewCardioLogs(todaysCardio);
  };

  const handleDeleteCardio = (id) => {
    if (confirm("Remove this cardio session?")) {
      const dateStr = getDateStr(viewDate);
      const newLogs = deleteCardioLog(id);
      const todaysCardio = newLogs.filter(c => c.date === dateStr);
      setViewCardioLogs(todaysCardio);
    }
  };

  const handleSetChange = (exId, index, field, value) => {
    setSetInputs(prev => {
      const currentSets = [...prev[exId]];
      currentSets[index] = { ...currentSets[index], [field]: value };
      if (index === 0) { 
        for (let i = 1; i < currentSets.length; i++) {
          currentSets[i] = { ...currentSets[i], [field]: value };
        }
      }
      return { ...prev, [exId]: currentSets };
    });
  };

  const handleLogExercise = (exId) => {
    const setsToLog = setInputs[exId];
    if (!setsToLog) return;
    const validSets = setsToLog.filter(s => s.weight !== '');
    if (validSets.length === 0) return alert("Enter weight for at least one set.");
    
    const dateStr = getDateStr(viewDate);
    addLog(dateStr, exId, validSets);
    
    const strId = String(exId);
    if (!completedIds.includes(strId)) setCompletedIds([...completedIds, strId]);
    setExpandedIds(expandedIds.filter(id => id !== strId));
  };

  const toggleExpand = (exId) => {
    const strId = String(exId);
    if (expandedIds.includes(strId)) {
      setExpandedIds(expandedIds.filter(id => id !== strId));
    } else {
      setExpandedIds([...expandedIds, strId]);
    }
  };

  // --- RENDER HELPERS ---

  const viewDateStr = getDateStr(viewDate);
  const isToday = viewDateStr === todayDateStr;
  const dayName = DAYS[viewDate.getDay()];
  const formattedDate = viewDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const isScheduledRest = currentRoutine && currentRoutine.exercises.length === 0 && (!currentRoutine.cardio || currentRoutine.cardio.length === 0);
  const isNoRoutine = !currentRoutine;

  return (
    <div className="max-w-md mx-auto text-white pb-20">
      
      {/* 1. NAVIGATION HEADER */}
      <div className="mb-6 border-b border-zinc-800 pb-4">
        
        {/* Date Nav */}
        <div className="flex justify-between items-center mb-4">
            {/* Left Chevron */}
            <button 
                onClick={() => changeDay(-1)} 
                className="w-8 h-8 flex items-center justify-center bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            </button>
            
            <div className="text-center">
                <div className="text-xs text-blue-400 font-bold uppercase tracking-wider flex items-center gap-2 justify-center">
                    {formattedDate} 
                    {!isToday && (
                        <button onClick={jumpToToday} className="bg-zinc-800 text-[10px] px-2 py-0.5 rounded-full text-zinc-400 border border-zinc-700 hover:text-white">
                            Today
                        </button>
                    )}
                </div>
            </div>

            {/* Right Chevron */}
            <button 
                onClick={() => changeDay(1)} 
                className="w-8 h-8 flex items-center justify-center bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
            </button>
        </div>

        {/* Routine Name & Actions */}
        <div className="flex justify-between items-end">
            <div>
                <h1 className="text-3xl font-black italic uppercase">
                    {isAdHocRest ? 'Rest Day' : (currentRoutine ? currentRoutine.name : 'No Plan')}
                </h1>
                
                {/* Visual Indicator for Swapped Routine */}
                {isSwapped && (
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-orange-400 bg-orange-900/20 px-2 py-0.5 rounded border border-orange-900/50">
                            Swapped Routine
                        </span>
                        <button 
                            onClick={handleRevertSchedule}
                            className="text-[10px] text-zinc-400 hover:text-white underline"
                        >
                            Revert
                        </button>
                    </div>
                )}
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex gap-2">
                {/* Swap Button: Only if viewing ANOTHER day's routine */}
                {!isToday && !isNoRoutine && !isScheduledRest && (
                    <button 
                        onClick={handleSwapToToday}
                        className="text-[10px] bg-blue-900/30 text-blue-300 border border-blue-500/50 px-3 py-1.5 rounded font-bold uppercase hover:bg-blue-900/50"
                    >
                        Do This Today
                    </button>
                )}

                {/* Rest Button */}
                {!isScheduledRest && !isNoRoutine && !isAdHocRest && (
                    <button 
                        onClick={handleToggleAdHocRest}
                        className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-3 py-1.5 rounded border border-zinc-700 transition"
                    >
                        Rest
                    </button>
                )}
            </div>
        </div>
      </div>

      {/* 2. BODY WEIGHT */}
      <div className="mb-4">
        {viewWeight ? (
          <div className="bg-zinc-900/50 border border-green-900/50 p-3 rounded-lg flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-green-900/20 text-green-500 p-2 rounded-full">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <div>
                <span className="text-xs text-green-500 font-bold uppercase block">Morning Weight</span>
                <span className="text-white font-bold">{viewWeight} lbs</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
            <label className="text-xs text-zinc-500 font-bold uppercase block mb-2">Morning Body Weight</label>
            <div className="flex gap-2">
              <input type="number" placeholder="0.0" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} className="flex-1 bg-black border border-zinc-700 rounded p-2 text-white outline-none focus:border-blue-500 transition" />
              <button onClick={handleSaveWeight} className="bg-white text-black font-bold px-4 rounded text-sm hover:bg-gray-200 transition">Save</button>
            </div>
          </div>
        )}
      </div>

      {/* 3. CARDIO SECTION */}
      <div className="mb-8">
        
        {/* Planned Cardio */}
        {routineCardio.length > 0 && !isAdHocRest && (
            <div className="mb-4">
                <h3 className="text-xs text-blue-400 font-bold uppercase mb-2">Planned Cardio</h3>
                <div className="space-y-2">
                    {routineCardio.map((planned) => {
                        const isDone = viewCardioLogs.some(l => l.type === planned.type);
                        
                        return (
                            <div key={planned.id} className={`p-3 rounded-lg border flex justify-between items-center ${isDone ? 'bg-zinc-900 border-green-900/50 opacity-70' : 'bg-zinc-900 border-blue-900/30'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${isDone ? 'bg-green-900/20 text-green-500' : 'bg-blue-900/20 text-blue-400'}`}>
                                        <span className="text-xs font-bold">C</span>
                                    </div>
                                    <div>
                                        <span className={`text-xs font-bold uppercase block ${isDone ? 'text-green-500 line-through' : 'text-blue-400'}`}>{planned.type}</span>
                                        <span className="text-white font-bold text-sm">Target: {planned.duration}m</span>
                                    </div>
                                </div>
                                {!isDone && (
                                    <button 
                                        onClick={() => handleCompletePlannedCardio(planned)}
                                        className="bg-white text-black font-bold text-xs px-3 py-1.5 rounded hover:bg-gray-200"
                                    >
                                        Log
                                    </button>
                                )}
                                {isDone && <span className="text-green-500 text-xs font-bold uppercase">Done</span>}
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {/* Logged Cardio */}
        {viewCardioLogs.length > 0 && (
          <div className="space-y-2 mb-2">
            <h3 className="text-xs text-zinc-500 font-bold uppercase mb-1">Completed Log</h3>
            {viewCardioLogs.map(cardio => (
              <div key={cardio.id} className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-lg flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-zinc-800 text-zinc-400 p-2 rounded-full">
                    <span className="text-xs font-bold">✓</span>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-400 font-bold uppercase block">{cardio.type}</span>
                    <span className="text-zinc-300 text-sm">{cardio.duration} mins</span>
                  </div>
                </div>
                <button onClick={() => handleDeleteCardio(cardio.id)} className="text-zinc-600 hover:text-red-500 px-2">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Ad-Hoc Toggle */}
        {!isAdHocRest && (
            !showCardioForm ? (
            <button onClick={() => setShowCardioForm(true)} className="w-full py-3 border border-dashed border-zinc-800 text-zinc-500 text-xs font-bold uppercase rounded hover:bg-zinc-900 transition">
                + Log Additional Cardio
            </button>
            ) : (
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg animate-fade-in">
                <div className="flex justify-between items-center mb-3">
                <span className="text-xs text-blue-400 font-bold uppercase">New Cardio Session</span>
                <button onClick={() => setShowCardioForm(false)} className="text-zinc-500 hover:text-white">✕</button>
                </div>
                <div className="space-y-3">
                <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Type</label>
                    <select value={cardioType} onChange={(e) => setCardioType(e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-2 text-white outline-none">
                    {CARDIO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="flex gap-3">
                    <div className="flex-1">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Duration (min)</label>
                    <input type="number" value={cardioDuration} onChange={(e) => setCardioDuration(e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-2 text-white outline-none" placeholder="0" />
                    </div>
                    <div className="flex-1">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Distance (opt)</label>
                    <input type="number" value={cardioDistance} onChange={(e) => setCardioDistance(e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-2 text-white outline-none" placeholder="-" />
                    </div>
                </div>
                <button onClick={handleSaveCardio} className="w-full bg-white text-black font-bold py-2 rounded text-sm hover:bg-gray-200 mt-2">Log Cardio</button>
                </div>
            </div>
            )
        )}
      </div>

      {/* 4. MAIN CONTENT */}
      {isAdHocRest ? (
        <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/50 rounded-xl border border-zinc-800">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4"><span className="text-3xl">☕</span></div>
            <h2 className="text-2xl font-black italic uppercase text-white mb-2">Taking it Easy</h2>
            <p className="text-zinc-500 text-sm mb-6">Recovery is when the growth happens.</p>
            <button onClick={handleToggleAdHocRest} className="text-xs text-zinc-600 underline hover:text-white">No, I actually want to workout</button>
        </div>
      ) : isScheduledRest ? (
        <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/50 rounded-xl border border-zinc-800">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4"><span className="text-3xl">☕</span></div>
            <h2 className="text-2xl font-black italic uppercase text-white mb-2">Scheduled Rest</h2>
            <p className="text-zinc-500 text-sm mb-6">Enjoy your day off.</p>
        </div>
      ) : isNoRoutine ? (
        <div className="text-center mt-10 text-gray-500">
          <p>No routine scheduled for {dayName}.</p>
          <p className="text-xs mt-4">Go to "Manage" to set up a routine.</p>
        </div>
      ) : (
        /* LIST EXERCISES */
        <div className="space-y-4">
          {exercises.map(ex => {
            const strId = String(ex.id);
            const isComplete = completedIds.includes(strId);
            const isExpanded = expandedIds.includes(strId);
            const showBody = !isComplete || isExpanded;
            const lastStats = lastPerformances[ex.id];

            return (
              <div key={ex.id} className={`rounded-lg overflow-hidden transition-all duration-300 border ${isComplete ? 'bg-zinc-900 border-green-900/50' : 'bg-zinc-900 border-zinc-800'}`}>
                <div onClick={() => isComplete && toggleExpand(ex.id)} className={`p-4 flex justify-between items-center ${isComplete ? 'cursor-pointer select-none' : ''}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={`font-bold text-lg ${isComplete ? 'text-green-400 line-through' : 'text-gray-200'}`}>{ex.name}</h3>
                      {isComplete && <span className="bg-green-900 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Done</span>}
                    </div>
                    <span className="text-xs text-gray-500 uppercase">{ex.category}</span>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    {isComplete ? (
                      <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1">{isExpanded ? 'Hide' : 'Show'} <span className={`text-lg leading-none transition-transform ${isExpanded ? 'rotate-180' : ''}`}>⌄</span></div>
                    ) : (
                      <>
                        <div className="mb-1"><span className="text-[10px] text-zinc-500 uppercase font-bold block">GOAL</span><span className="text-sm font-mono text-blue-400 font-bold">{ex.targetSets} x {ex.targetReps}</span></div>
                        {lastStats && <div><span className="text-[10px] text-zinc-500 uppercase font-bold block">LAST</span><span className="text-sm font-mono text-gray-300">{lastStats}</span></div>}
                      </>
                    )}
                  </div>
                </div>
                {showBody && (
                  <div className={isComplete ? "opacity-50" : ""}>
                    <div className="px-4 pb-4 space-y-3">
                      <div className="flex text-[10px] text-gray-500 uppercase font-bold px-1"><div className="w-8 text-center">Set</div><div className="flex-1 text-center">Lbs</div><div className="flex-1 text-center">Reps</div></div>
                      {setInputs[ex.id]?.map((set, idx) => (
                        <div key={idx} className="flex gap-3 items-center">
                          <div className="w-8 text-center text-zinc-600 font-bold text-sm">{idx + 1}</div>
                          <div className="flex-1"><input type="number" placeholder="-" value={set.weight} onChange={(e) => handleSetChange(ex.id, idx, 'weight', e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-center outline-none focus:border-blue-500 transition font-mono" /></div>
                          <div className="flex-1"><input type="number" placeholder="-" value={set.reps} onChange={(e) => handleSetChange(ex.id, idx, 'reps', e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-center outline-none focus:border-blue-500 transition font-mono" /></div>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 bg-zinc-800/20 border-t border-zinc-800">
                      <button onClick={() => handleLogExercise(ex.id)} className="w-full bg-white text-black font-bold py-3 rounded hover:bg-gray-200 transition tracking-widest text-xs uppercase">{isComplete ? 'Update Log' : 'Complete Exercise'}</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}