import React, { useState, useEffect } from 'react';
import { getExercises, getRoutines, saveRoutine, deleteRoutine } from '../dataManager';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function RoutineManager() {
  const [routines, setRoutines] = useState([]);
  const [allExercises, setAllExercises] = useState([]);
  
  // Form State
  const [selectedDay, setSelectedDay] = useState(DAYS[0]);
  const [routineName, setRoutineName] = useState('');
  const [selectedExercises, setSelectedExercises] = useState([]); 
  const [isRestDay, setIsRestDay] = useState(false); // <--- NEW STATE

  // Edit Mode State
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setAllExercises(getExercises());
    setRoutines(getRoutines());
  };

  const toggleExercise = (ex) => {
    if (isRestDay) return; // Prevent selection on rest days

    const isSelected = selectedExercises.find(item => item.id === ex.id);
    if (isSelected) {
      setSelectedExercises(selectedExercises.filter(item => item.id !== ex.id));
    } else {
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

  // Toggle the Rest Day mode
  const handleRestToggle = () => {
    const newState = !isRestDay;
    setIsRestDay(newState);
    if (newState) {
      setRoutineName('Rest Day');
      setSelectedExercises([]);
    } else {
      setRoutineName('');
    }
  };

  const handleEdit = (routine) => {
    setEditingId(routine.id);
    setSelectedDay(routine.day);
    
    // Check if it's a rest day (empty exercises)
    if (routine.exercises.length === 0) {
      setIsRestDay(true);
      setRoutineName('Rest Day');
      setSelectedExercises([]);
    } else {
      setIsRestDay(false);
      setRoutineName(routine.name);
      
      const hydratedExercises = routine.exercises.map(savedEx => {
        const exId = typeof savedEx === 'object' ? savedEx.id : savedEx;
        const sets = savedEx.sets || 3;
        const reps = savedEx.reps || 10;
        const fullEx = allExercises.find(e => String(e.id) === String(exId));
        
        if (!fullEx) return null;
        return {
            id: fullEx.id,
            name: fullEx.name,
            targetSets: sets,
            targetReps: reps
        };
      }).filter(Boolean);

      setSelectedExercises(hydratedExercises);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setRoutineName('');
    setSelectedExercises([]);
    setSelectedDay(DAYS[0]);
    setIsRestDay(false);
  };

  const handleSave = () => {
    // Validation: Need name AND exercises, UNLESS it is a rest day
    if (!routineName) return alert("Name required");
    if (!isRestDay && selectedExercises.length === 0) return alert("Select exercises or mark as Rest Day");
    
    const exercisesToSave = selectedExercises.map(ex => ({
      id: ex.id,
      sets: ex.targetSets,
      reps: ex.targetReps
    }));

    saveRoutine({
      id: editingId, 
      day: selectedDay,
      name: routineName,
      exercises: exercisesToSave // Will be empty [] if rest day
    });
    
    handleCancelEdit();
    loadData();
    alert(editingId ? "Routine Updated!" : `Saved routine for ${selectedDay}`);
  };

  const handleDelete = (id) => {
    if (confirm("Delete this routine?")) {
      deleteRoutine(id);
      if (editingId === id) handleCancelEdit();
      loadData();
    }
  };

  return (
    <div className="max-w-md mx-auto text-white pb-20">
      <h2 className="text-xl font-bold mb-4 text-gray-300">
        {editingId ? 'Edit Routine' : 'Routine Builder'}
      </h2>

      <div className={`p-4 rounded-lg border mb-8 transition-colors ${editingId ? 'bg-zinc-800 border-blue-500/50' : 'bg-zinc-900 border-zinc-800'}`}>
        
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

        {/* Rest Day Toggle */}
        <div 
          onClick={handleRestToggle}
          className={`flex items-center gap-3 p-3 rounded mb-4 cursor-pointer border ${isRestDay ? 'bg-green-900/20 border-green-500/50' : 'bg-black border-zinc-800'}`}
        >
          <div className={`w-5 h-5 rounded border flex items-center justify-center ${isRestDay ? 'bg-green-500 border-green-500' : 'border-zinc-600'}`}>
            {isRestDay && <span className="text-black text-xs font-bold">✓</span>}
          </div>
          <span className={isRestDay ? 'text-green-400 font-bold' : 'text-gray-400'}>Set as Rest Day</span>
        </div>

        {/* Inputs (Disabled if Rest Day) */}
        <div className={isRestDay ? 'opacity-30 pointer-events-none grayscale' : ''}>
          <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Routine Name</label>
          <input 
            type="text" 
            value={routineName}
            onChange={(e) => setRoutineName(e.target.value)}
            placeholder="e.g. Heavy Legs"
            className="w-full p-2 mb-4 rounded bg-black border border-zinc-700 text-white outline-none focus:border-white transition"
          />

          <label className="block text-xs text-gray-500 uppercase font-bold mb-2">Select Exercises</label>
          <div className="max-h-64 overflow-y-auto space-y-2 mb-4 border border-zinc-800 p-2 rounded bg-black/50">
            {allExercises.map(ex => {
              const isSelected = selectedExercises.find(item => String(item.id) === String(ex.id));
              return (
                <div 
                  key={ex.id} 
                  className={`p-2 rounded transition border ${
                    isSelected ? 'bg-zinc-800 border-zinc-600' : 'hover:bg-zinc-900 border-transparent'
                  }`}
                >
                  <div 
                    onClick={() => toggleExercise(ex)}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <div className={`w-4 h-4 rounded border ${isSelected ? 'bg-white border-white' : 'border-gray-500'}`}></div>
                    <span className={isSelected ? 'text-white font-bold' : 'text-gray-400'}>{ex.name}</span>
                  </div>

                  {isSelected && (
                    <div className="flex gap-2 mt-2 ml-7">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase">Sets</span>
                        <input 
                          type="number" 
                          value={isSelected.targetSets}
                          onChange={(e) => updateTarget(ex.id, 'targetSets', e.target.value)}
                          className="w-16 bg-black border border-zinc-600 rounded p-1 text-sm text-center outline-none focus:border-blue-400"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase">Reps</span>
                        <input 
                          type="number" 
                          value={isSelected.targetReps}
                          onChange={(e) => updateTarget(ex.id, 'targetReps', e.target.value)}
                          className="w-16 bg-black border border-zinc-600 rounded p-1 text-sm text-center outline-none focus:border-blue-400"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
            {editingId && (
                <button 
                    onClick={handleCancelEdit}
                    className="flex-1 bg-zinc-700 text-white font-bold py-3 rounded hover:bg-zinc-600 transition uppercase tracking-widest text-xs"
                >
                    Cancel
                </button>
            )}
            <button 
            onClick={handleSave}
            className={`flex-[2] text-black font-bold py-3 rounded transition uppercase tracking-widest text-xs ${
                editingId ? 'bg-blue-400 hover:bg-blue-300' : 'bg-white hover:bg-gray-200'
            }`}
            >
            {editingId ? 'Update Routine' : 'Save Routine'}
            </button>
        </div>
      </div>

      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Your Schedule</h3>
      <div className="space-y-3">
        {routines.sort((a,b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day)).map(routine => {
            const isRest = routine.exercises.length === 0;
            return (
              <div key={routine.id} className={`bg-zinc-900/50 border p-3 rounded flex justify-between items-center ${editingId === routine.id ? 'border-blue-500 bg-blue-900/10' : 'border-zinc-800'}`}>
                <div>
                  <span className="text-xs text-blue-400 font-bold uppercase block">{routine.day}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-lg">{routine.name}</span>
                    {isRest && <span className="bg-zinc-800 text-gray-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Rest</span>}
                  </div>
                </div>
                
                <div className="flex gap-2">
                    <button 
                        onClick={() => handleEdit(routine)}
                        className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded transition"
                    >
                        Edit
                    </button>
                    <button 
                        onClick={() => handleDelete(routine.id)} 
                        className="text-xs bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/50 px-3 py-2 rounded transition"
                    >
                        ✕
                    </button>
                </div>
              </div>
            );
        })}
      </div>
    </div>
  );
}