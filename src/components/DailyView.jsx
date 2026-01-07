import React, { useState, useEffect } from 'react';
import { getRoutines, getExercises, addLog, getLogs } from '../dataManager';

export default function DailyView() {
  const [todayRoutine, setTodayRoutine] = useState(null);
  const [todayExercises, setTodayExercises] = useState([]);
  const [currentDay, setCurrentDay] = useState('');
  
  // setInputs holds the data. setSetInputs updates it.
  const [setInputs, setSetInputs] = useState({});
  
  const [completedIds, setCompletedIds] = useState([]);
  const [expandedIds, setExpandedIds] = useState([]);

  useEffect(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayDateObj = new Date();
    const todayDayName = days[todayDateObj.getDay()];
    const todayDateString = todayDateObj.toISOString().split('T')[0];
    
    setCurrentDay(todayDayName);

    // 1. Check for existing logs
    const allLogs = getLogs();
    const todaysLogs = allLogs.filter(log => log.date === todayDateString);
    const doneIds = todaysLogs.map(log => log.exerciseId);
    setCompletedIds(doneIds);

    // 2. Load Routine
    const routines = getRoutines();
    const routine = routines.find(r => r.day === todayDayName);
    
    if (routine) {
      setTodayRoutine(routine);
      const allExercises = getExercises();
      
      const mergedData = routine.exercises.map(routineEx => {
        const exId = typeof routineEx === 'object' ? routineEx.id : routineEx;
        const targetSets = routineEx.sets || 3; 
        const targetReps = routineEx.reps || 10;
        
        const fullExercise = allExercises.find(e => e.id === exId);
        return { ...fullExercise, targetSets, targetReps };
      }).filter(ex => ex && ex.name);

      setTodayExercises(mergedData);

      // 3. Initialize Inputs
      const initialInputs = {};
      mergedData.forEach(ex => {
        initialInputs[ex.id] = Array(parseInt(ex.targetSets)).fill().map(() => ({
          weight: '',
          reps: ex.targetReps
        }));
      });
      setSetInputs(initialInputs);
    }
  }, []);

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
    // FIX IS HERE: Use 'setInputs', NOT 'setSetInputs'
    const setsToLog = setInputs[exId]; 
    
    if (!setsToLog) return; // Safety check

    const validSets = setsToLog.filter(s => s.weight !== '');
    
    if (validSets.length === 0) return alert("Please enter weight for at least one set.");

    addLog(
      new Date().toISOString().split('T')[0],
      exId,
      validSets 
    );

    // Mark as complete
    if (!completedIds.includes(exId)) {
      setCompletedIds([...completedIds, exId]);
    }
    
    // Force collapse
    setExpandedIds(expandedIds.filter(id => id !== exId));
  };

  const toggleExpand = (exId) => {
    if (expandedIds.includes(exId)) {
      setExpandedIds(expandedIds.filter(id => id !== exId));
    } else {
      setExpandedIds([...expandedIds, exId]);
    }
  };

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
      <div className="mb-6 border-b border-zinc-800 pb-4">
        <h2 className="text-sm text-blue-400 font-bold uppercase tracking-wider">{currentDay}</h2>
        <h1 className="text-3xl font-black italic uppercase">{todayRoutine.name}</h1>
      </div>

      <div className="space-y-4">
        {todayExercises.map(ex => {
          const isComplete = completedIds.includes(ex.id);
          const isExpanded = expandedIds.includes(ex.id);
          
          const showBody = !isComplete || isExpanded;

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
                
                <div className="text-right">
                  {isComplete ? (
                    <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                      {isExpanded ? 'Hide' : 'Show'} 
                      <span className={`text-lg leading-none transition-transform ${isExpanded ? 'rotate-180' : ''}`}>⌄</span>
                    </div>
                  ) : (
                    <>
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block">GOAL</span>
                      <span className="text-sm font-mono text-blue-400 font-bold">
                        {ex.targetSets} x {ex.targetReps}
                      </span>
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