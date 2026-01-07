import React, { useState, useEffect } from 'react';
import { 
  getRoutines, getExercises, addLog, getLogs, // Lifting
  getBodyWeights, addBodyWeight,              // Body Weight
  getCardioLogs, addCardioLog, deleteCardioLog // Cardio
} from '../dataManager';

export default function DailyView() {
  const [todayRoutine, setTodayRoutine] = useState(null);
  const [todayExercises, setTodayExercises] = useState([]);
  const [currentDay, setCurrentDay] = useState('');
  
  // Exercise State
  const [setInputs, setSetInputs] = useState({});
  const [completedIds, setCompletedIds] = useState([]);
  const [expandedIds, setExpandedIds] = useState([]);
  const [lastPerformances, setLastPerformances] = useState({});

  // Body Weight State
  const [todayWeight, setTodayWeight] = useState(null); 
  const [weightInput, setWeightInput] = useState('');

  // Cardio State
  const [todayCardioLogs, setTodayCardioLogs] = useState([]); 
  const [routineCardio, setRoutineCardio] = useState([]);     
  
  // Ad-Hoc Cardio Form State
  const [cardioType, setCardioType] = useState('Run');
  const [cardioDuration, setCardioDuration] = useState(''); 
  const [cardioDistance, setCardioDistance] = useState(''); 
  const [showCardioForm, setShowCardioForm] = useState(false);

  // Rest Day State
  const [isAdHocRest, setIsAdHocRest] = useState(false);
  const [todayDate, setTodayDate] = useState('');

  const CARDIO_TYPES = ['Run', 'Walk', 'Cycle', 'Treadmill', 'Stairmaster', 'Rowing', 'Elliptical', 'HIIT', 'Other'];

  useEffect(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dateObj = new Date();
    const dayName = days[dateObj.getDay()];
    const dateStr = dateObj.toISOString().split('T')[0];
    
    setCurrentDay(dayName);
    setTodayDate(dateStr);

    // 1. Check Rest
    const restKey = `onyx_rest_${dateStr}`;
    if (localStorage.getItem(restKey) === 'true') setIsAdHocRest(true);

    // 2. Load Weight
    const weights = getBodyWeights();
    const existingWeight = weights.find(w => w.date === dateStr);
    if (existingWeight) setTodayWeight(existingWeight.weight);

    // 3. Load Completed Cardio Logs
    const cLogs = getCardioLogs();
    const todaysCardio = cLogs.filter(c => c.date === dateStr);
    setTodayCardioLogs(todaysCardio);

    // 4. Load Lifting Logs
    const allLogs = getLogs();
    const todaysLogs = allLogs.filter(log => log.date === dateStr);
    const doneIds = todaysLogs.map(log => String(log.exerciseId));
    setCompletedIds(doneIds);

    // 5. Load Routine & Planned Cardio
    const routines = getRoutines();
    const routine = routines.find(r => r.day === dayName);
    
    if (routine) {
      setTodayRoutine(routine);
      
      if (routine.cardio) {
        setRoutineCardio(routine.cardio);
      }

      const allExercises = getExercises();
      const mergedData = routine.exercises.map(routineEx => {
        const exId = typeof routineEx === 'object' ? routineEx.id : routineEx;
        const targetSets = routineEx.sets || 3; 
        const targetReps = routineEx.reps || 10;
        const fullExercise = allExercises.find(e => String(e.id) === String(exId));
        return { ...fullExercise, targetSets, targetReps };
      }).filter(ex => ex && ex.name);

      setTodayExercises(mergedData);

      const initialInputs = {};
      mergedData.forEach(ex => {
        initialInputs[ex.id] = Array(parseInt(ex.targetSets)).fill().map(() => ({
          weight: '',
          reps: ex.targetReps
        }));
      });
      setSetInputs(initialInputs);

      // Calc History stats
      const historyStats = {};
      mergedData.forEach(ex => {
        const pastLogs = allLogs.filter(l => String(l.exerciseId) === String(ex.id) && l.date !== dateStr);
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
    }
  }, []);

  // --- ACTIONS ---

  const handleToggleAdHocRest = () => {
    const newState = !isAdHocRest;
    setIsAdHocRest(newState);
    if (newState) {
      localStorage.setItem(`onyx_rest_${todayDate}`, 'true');
    } else {
      localStorage.removeItem(`onyx_rest_${todayDate}`);
    }
  };

  const handleSaveWeight = () => {
    if (!weightInput) return;
    addBodyWeight(weightInput, todayDate);
    setTodayWeight(weightInput);
  };

  const handleSaveCardio = () => {
    if (!cardioDuration) return alert("Duration is required");
    const newLogs = addCardioLog(todayDate, cardioType, cardioDuration, cardioDistance);
    const todaysCardio = newLogs.filter(c => c.date === todayDate);
    setTodayCardioLogs(todaysCardio);
    setCardioDuration('');
    setCardioDistance('');
    setShowCardioForm(false);
  };

  const handleCompletePlannedCardio = (plannedItem) => {
    const newLogs = addCardioLog(todayDate, plannedItem.type, plannedItem.duration, plannedItem.distance);
    const todaysCardio = newLogs.filter(c => c.date === todayDate);
    setTodayCardioLogs(todaysCardio);
  };

  const handleDeleteCardio = (id) => {
    if (confirm("Remove this cardio session?")) {
      const newLogs = deleteCardioLog(id);
      const todaysCardio = newLogs.filter(c => c.date === todayDate);
      setTodayCardioLogs(todaysCardio);
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
    if (validSets.length === 0) return alert("Please enter weight for at least one set.");
    addLog(todayDate, exId, validSets);
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

  // --- RENDER ---
  
  const isScheduledRest = todayRoutine && todayRoutine.exercises.length === 0 && (!todayRoutine.cardio || todayRoutine.cardio.length === 0);
  const isNoRoutine = !todayRoutine;

  return (
    <div className="max-w-md mx-auto text-white pb-20">
      
      {/* Header */}
      <div className="mb-6 border-b border-zinc-800 pb-4 flex justify-between items-end">
        <div>
          <h2 className="text-sm text-blue-400 font-bold uppercase tracking-wider">{currentDay}</h2>
          <h1 className="text-3xl font-black italic uppercase">
            {isAdHocRest ? 'Rest Day' : (todayRoutine ? todayRoutine.name : 'No Plan')}
          </h1>
        </div>
        {!isScheduledRest && !isNoRoutine && !isAdHocRest && (
          <button onClick={handleToggleAdHocRest} className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-3 py-1.5 rounded border border-zinc-700 transition">Take Rest Day</button>
        )}
      </div>

      {/* 1. BODY WEIGHT */}
      <div className="mb-4">
        {todayWeight ? (
          <div className="bg-zinc-900/50 border border-green-900/50 p-3 rounded-lg flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-green-900/20 text-green-500 p-2 rounded-full">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <div>
                <span className="text-xs text-green-500 font-bold uppercase block">Morning Weight</span>
                <span className="text-white font-bold">{todayWeight} lbs</span>
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

      {/* 2. CARDIO SECTION */}
      <div className="mb-8">
        
        {/* A. PLANNED CARDIO (Hidden if taking Ad-Hoc Rest Day) */}
        {routineCardio.length > 0 && !isAdHocRest && (
            <div className="mb-4">
                <h3 className="text-xs text-blue-400 font-bold uppercase mb-2">Planned Cardio</h3>
                <div className="space-y-2">
                    {routineCardio.map((planned) => {
                        const isDone = todayCardioLogs.some(l => l.type === planned.type);
                        
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

        {/* B. LOGGED CARDIO LIST */}
        {todayCardioLogs.length > 0 && (
          <div className="space-y-2 mb-2">
            <h3 className="text-xs text-zinc-500 font-bold uppercase mb-1">Completed Log</h3>
            {todayCardioLogs.map(cardio => (
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

        {/* C. AD-HOC TOGGLE (Hidden if Rest Day) */}
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

      {/* 3. WORKOUT LIST OR REST */}
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
          <p>No routine scheduled for today.</p>
          <p className="text-xs mt-4">Go to "Manage" to set up a routine.</p>
        </div>
      ) : (
        /* LIST EXERCISES */
        <div className="space-y-4">
          {todayExercises.map(ex => {
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