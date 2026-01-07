import React, { useState, useEffect } from 'react';
import { 
  getRoutines, getExercises, addLog, getLogs, // Exercise Data
  getBodyWeights, addBodyWeight // Weight Data
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
  const [todayWeight, setTodayWeight] = useState(null); // null or the logged value
  const [weightInput, setWeightInput] = useState('');

  useEffect(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayDateObj = new Date();
    const todayDayName = days[todayDateObj.getDay()];
    const todayDateString = todayDateObj.toISOString().split('T')[0];
    
    setCurrentDay(todayDayName);

    // --- 1. CHECK BODY WEIGHT STATUS ---
    const weights = getBodyWeights();
    const existingWeight = weights.find(w => w.date === todayDateString);
    if (existingWeight) {
      setTodayWeight(existingWeight.weight);
    }

    // --- 2. LOAD WORKOUT LOGS ---
    const allLogs = getLogs();
    const todaysLogs = allLogs.filter(log => log.date === todayDateString);
    const doneIds = todaysLogs.map(log => String(log.exerciseId));
    setCompletedIds(doneIds);

    // --- 3. LOAD ROUTINE ---
    const routines = getRoutines();
    const routine = routines.find(r => r.day === todayDayName);
    
    if (routine) {
      setTodayRoutine(routine);
      const allExercises = getExercises();
      
      const mergedData = routine.exercises.map(routineEx => {
        const exId = typeof routineEx === 'object' ? routineEx.id : routineEx;
        const targetSets = routineEx.sets || 3; 
        const targetReps = routineEx.reps || 10;
        
        const fullExercise = allExercises.find(e => String(e.id) === String(exId));
        return { ...fullExercise, targetSets, targetReps };
      }).filter(ex => ex && ex.name);

      setTodayExercises(mergedData);

      // Initialize Inputs
      const initialInputs = {};
      mergedData.forEach(ex => {
        initialInputs[ex.id] = Array(parseInt(ex.targetSets)).fill().map(() => ({
          weight: '',
          reps: ex.targetReps
        }));
      });
      setSetInputs(initialInputs);

      // Calculate "Last Time" Stats
      const historyStats = {};
      mergedData.forEach(ex => {
        const pastLogs = allLogs.filter(l => 
          String(l.exerciseId) === String(ex.id) && 
          l.date !== todayDateString 
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
    }
  }, []);

  // --- ACTIONS ---

  const handleSaveWeight = () => {
    if (!weightInput) return;
    const todayStr = new Date().toISOString().split('T')[0];
    addBodyWeight(weightInput, todayStr);
    setTodayWeight(weightInput);
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

    addLog(
      new Date().toISOString().split('T')[0],
      exId,
      validSets 
    );

    const strId = String(exId);
    if (!completedIds.includes(strId)) {
      setCompletedIds([...completedIds, strId]);
    }
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

  if (!todayRoutine) {
    return (
      <div className="text-center mt-20 text-gray-500">
        <h2 className="text-2xl text-white font-bold mb-2">{currentDay}</h2>
        <p>No routine scheduled for today.</p>
        <p className="text-xs mt-4">Go to "Manage" to set up a routine.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto text-white pb-20">
      
      {/* 1. Header */}
      <div className="mb-6 border-b border-zinc-800 pb-4">
        <h2 className="text-sm text-blue-400 font-bold uppercase tracking-wider">{currentDay}</h2>
        <h1 className="text-3xl font-black italic uppercase">{todayRoutine.name}</h1>
      </div>

      {/* 2. Morning Check-In (Body Weight) */}
      <div className="mb-8">
        {todayWeight ? (
          // STATE: LOGGED
          <div className="bg-zinc-900/50 border border-green-900/50 p-3 rounded-lg flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-green-900/20 text-green-500 p-2 rounded-full">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <div>
                <span className="text-xs text-green-500 font-bold uppercase block">Morning Check-In</span>
                <span className="text-white font-bold">{todayWeight} lbs</span>
              </div>
            </div>
          </div>
        ) : (
          // STATE: NOT LOGGED
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
            <label className="text-xs text-zinc-500 font-bold uppercase block mb-2">Morning Body Weight</label>
            <div className="flex gap-2">
              <input 
                type="number" 
                placeholder="0.0" 
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="flex-1 bg-black border border-zinc-700 rounded p-2 text-white outline-none focus:border-blue-500 transition"
              />
              <button 
                onClick={handleSaveWeight}
                className="bg-white text-black font-bold px-4 rounded text-sm hover:bg-gray-200 transition"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Routine List */}
      <div className="space-y-4">
        {todayExercises.map(ex => {
          const strId = String(ex.id);
          const isComplete = completedIds.includes(strId);
          const isExpanded = expandedIds.includes(strId);
          const showBody = !isComplete || isExpanded;
          const lastStats = lastPerformances[ex.id];

          return (
            <div 
              key={ex.id} 
              className={`rounded-lg overflow-hidden transition-all duration-300 border ${
                isComplete 
                  ? 'bg-zinc-900 border-green-900/50' 
                  : 'bg-zinc-900 border-zinc-800'
              }`}
            >
              
              {/* Header */}
              <div 
                onClick={() => isComplete && toggleExpand(ex.id)}
                className={`p-4 flex justify-between items-center ${isComplete ? 'cursor-pointer select-none' : ''}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={`font-bold text-lg ${isComplete ? 'text-green-400 line-through' : 'text-gray-200'}`}>
                      {ex.name}
                    </h3>
                    {isComplete && (
                      <span className="bg-green-900 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Done
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 uppercase">{ex.category}</span>
                </div>
                
                <div className="text-right flex flex-col items-end">
                  {isComplete ? (
                    <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                      {isExpanded ? 'Hide' : 'Show'} 
                      <span className={`text-lg leading-none transition-transform ${isExpanded ? 'rotate-180' : ''}`}>⌄</span>
                    </div>
                  ) : (
                    <>
                      <div className="mb-1">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold block">GOAL</span>
                        <span className="text-sm font-mono text-blue-400 font-bold">
                          {ex.targetSets} x {ex.targetReps}
                        </span>
                      </div>
                      {lastStats && (
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase font-bold block">LAST</span>
                          <span className="text-sm font-mono text-gray-300">
                            {lastStats}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Body */}
              {showBody && (
                <div className={isComplete ? "opacity-50" : ""}>
                  <div className="px-4 pb-4 space-y-3">
                    <div className="flex text-[10px] text-gray-500 uppercase font-bold px-1">
                      <div className="w-8 text-center">Set</div>
                      <div className="flex-1 text-center">Lbs</div>
                      <div className="flex-1 text-center">Reps</div>
                    </div>

                    {setInputs[ex.id]?.map((set, idx) => (
                      <div key={idx} className="flex gap-3 items-center">
                        <div className="w-8 text-center text-zinc-600 font-bold text-sm">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <input 
                            type="number" 
                            placeholder="-"
                            value={set.weight}
                            onChange={(e) => handleSetChange(ex.id, idx, 'weight', e.target.value)}
                            className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-center outline-none focus:border-blue-500 transition font-mono"
                          />
                        </div>
                        <div className="flex-1">
                          <input 
                            type="number" 
                            placeholder="-"
                            value={set.reps}
                            onChange={(e) => handleSetChange(ex.id, idx, 'reps', e.target.value)}
                            className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-center outline-none focus:border-blue-500 transition font-mono"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-zinc-800/20 border-t border-zinc-800">
                    <button 
                      onClick={() => handleLogExercise(ex.id)}
                      className="w-full bg-white text-black font-bold py-3 rounded hover:bg-gray-200 transition tracking-widest text-xs uppercase"
                    >
                      {isComplete ? 'Update Log' : 'Complete Exercise'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}