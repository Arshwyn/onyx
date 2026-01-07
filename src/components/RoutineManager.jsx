import React, { useState, useEffect } from 'react';
import { getExercises, getRoutines, saveRoutine, deleteRoutine } from '../dataManager';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function RoutineManager() {
  const [routines, setRoutines] = useState([]);
  const [allExercises, setAllExercises] = useState([]);
  
  // Form State
  const [selectedDay, setSelectedDay] = useState(DAYS[0]);
  const [routineName, setRoutineName] = useState('');
  
  // selectedExercises is now an array of objects: { id, name, targetSets, targetReps }
  const [selectedExercises, setSelectedExercises] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setAllExercises(getExercises());
    setRoutines(getRoutines());
  };

  const toggleExercise = (ex) => {
    const isSelected = selectedExercises.find(item => item.id === ex.id);
    
    if (isSelected) {
      // Remove it
      setSelectedExercises(selectedExercises.filter(item => item.id !== ex.id));
    } else {
      // Add it with defaults (3 sets of 10)
      setSelectedExercises([
        ...selectedExercises, 
        { id: ex.id, name: ex.name, targetSets: 3, targetReps: 10 }
      ]);
    }
  };

  const updateTarget = (exId, field, value) => {
    setSelectedExercises(prev => prev.map(item => {
      if (item.id === exId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleSave = () => {
    if (!routineName || selectedExercises.length === 0) return alert("Name and Exercises required");
    
    // We save the ID and the targets
    const exercisesToSave = selectedExercises.map(ex => ({
      id: ex.id,
      sets: ex.targetSets,
      reps: ex.targetReps
    }));

    saveRoutine({
      day: selectedDay,
      name: routineName,
      exercises: exercisesToSave
    });
    
    // Reset
    setRoutineName('');
    setSelectedExercises([]);
    loadData();
    alert(`Saved routine for ${selectedDay}`);
  };

  const handleDelete = (id) => {
    if (confirm("Delete this routine?")) {
      deleteRoutine(id);
      loadData();
    }
  };

  return (
    <div className="max-w-md mx-auto text-white pb-20">
      <h2 className="text-xl font-bold mb-4 text-gray-300">Routine Builder</h2>

      <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 mb-8">
        
        {/* Day Selector */}
        <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Day of Week</label>
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {DAYS.map(day => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-3 py-1 rounded text-sm whitespace-nowrap border ${
                selectedDay === day 
                  ? 'bg-white text-black border-white' 
                  : 'bg-black text-gray-400 border-zinc-700'
              }`}
            >
              {day}
            </button>
          ))}
        </div>

        {/* Routine Name */}
        <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Routine Name</label>
        <input 
          type="text" 
          value={routineName}
          onChange={(e) => setRoutineName(e.target.value)}
          placeholder="e.g. Heavy Legs"
          className="w-full p-2 mb-4 rounded bg-black border border-zinc-700 text-white outline-none"
        />

        {/* Exercise Selector */}
        <label className="block text-xs text-gray-500 uppercase font-bold mb-2">Select Exercises & Targets</label>
        <div className="max-h-64 overflow-y-auto space-y-2 mb-4 border border-zinc-800 p-2 rounded bg-black/50">
          {allExercises.map(ex => {
            const isSelected = selectedExercises.find(item => item.id === ex.id);
            return (
              <div 
                key={ex.id} 
                className={`p-2 rounded transition border ${
                  isSelected ? 'bg-zinc-800 border-zinc-600' : 'hover:bg-zinc-900 border-transparent'
                }`}
              >
                {/* Header: Checkbox + Name */}
                <div 
                  onClick={() => toggleExercise(ex)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <div className={`w-4 h-4 rounded border ${isSelected ? 'bg-white border-white' : 'border-gray-500'}`}></div>
                  <span className={isSelected ? 'text-white font-bold' : 'text-gray-400'}>{ex.name}</span>
                </div>

                {/* If Selected: Show Target Inputs */}
                {isSelected && (
                  <div className="flex gap-2 mt-2 ml-7">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-500 uppercase">Sets</span>
                      <input 
                        type="number" 
                        value={isSelected.targetSets}
                        onChange={(e) => updateTarget(ex.id, 'targetSets', e.target.value)}
                        className="w-16 bg-black border border-zinc-600 rounded p-1 text-sm text-center"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-500 uppercase">Reps</span>
                      <input 
                        type="number" 
                        value={isSelected.targetReps}
                        onChange={(e) => updateTarget(ex.id, 'targetReps', e.target.value)}
                        className="w-16 bg-black border border-zinc-600 rounded p-1 text-sm text-center"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button 
          onClick={handleSave}
          className="w-full bg-white text-black font-bold py-3 rounded hover:bg-gray-200 transition uppercase tracking-widest text-xs"
        >
          Save Routine
        </button>
      </div>

      {/* List Existing */}
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Your Schedule</h3>
      <div className="space-y-3">
        {routines.sort((a,b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day)).map(routine => (
          <div key={routine.id} className="bg-zinc-900/50 border border-zinc-800 p-3 rounded flex justify-between items-center">
            <div>
              <span className="text-xs text-blue-400 font-bold uppercase block">{routine.day}</span>
              <span className="text-white font-bold text-lg">{routine.name}</span>
            </div>
            <button onClick={() => handleDelete(routine.id)} className="text-red-500 hover:text-red-400 text-sm px-3">
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}