import React, { useState, useEffect } from 'react';
import { getExercises, getRoutines, saveRoutine, deleteRoutine, addExercise, deleteCustomExercise } from '../dataManager';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CARDIO_TYPES = ['Run', 'Walk', 'Cycle', 'Treadmill', 'Stairmaster', 'Rowing', 'Elliptical', 'HIIT', 'Other'];
const CATEGORIES = ['Push', 'Pull', 'Legs', 'Core', 'Other'];

export default function RoutineManager() {
  const [loading, setLoading] = useState(true);
  const [routines, setRoutines] = useState([]);
  const [allExercises, setAllExercises] = useState([]);
  
  // Form State
  const [selectedDay, setSelectedDay] = useState(DAYS[0]);
  const [routineName, setRoutineName] = useState('');
  const [selectedExercises, setSelectedExercises] = useState([]); 
  const [isRestDay, setIsRestDay] = useState(false);
  const [routineCardio, setRoutineCardio] = useState([]); 
  const [cardioInput, setCardioInput] = useState({ type: 'Run', duration: '', distance: '' });
  const [editingId, setEditingId] = useState(null);

  // New Exercise Modal State
  const [showNewExForm, setShowNewExForm] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExCat, setNewExCat] = useState('Push');

  useEffect(() => {
    loadData();
  }, []);

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

  // --- EXERCISE LOGIC ---
  const handleCreateExercise = async () => {
    if (!newExName) return alert("Name required");
    await addExercise(newExName, newExCat);
    setShowNewExForm(false);
    setNewExName('');
    const updated = await getExercises();
    setAllExercises(updated);
  };

  const handleDeleteExercise = async (e, id) => {
    e.stopPropagation(); 
    if(confirm("Delete this custom exercise?")) {
        await deleteCustomExercise(id);
        const updated = await getExercises();
        setAllExercises(updated);
    }
  }

  const toggleExercise = (ex) => {
    if (isRestDay) return;
    const isSelected = selectedExercises.find(item => String(item.id) === String(ex.id));
    if (isSelected) {
      setSelectedExercises(selectedExercises.filter(item => String(item.id) !== String(ex.id)));
    } else {
      // Add to end of list
      setSelectedExercises([
        ...selectedExercises, 
        { id: ex.id, name: ex.name, targetSets: 3, targetReps: 10 }
      ]);
    }
  };

  const updateTarget = (exId, field, value) => {
    setSelectedExercises(prev => prev.map(item => {
      if (String(item.id) === String(exId)) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const moveExercise = (index, direction) => {
    if (direction === -1 && index === 0) return;
    if (direction === 1 && index === selectedExercises.length - 1) return;

    const newOrder = [...selectedExercises];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index + direction];
    newOrder[index + direction] = temp;
    
    setSelectedExercises(newOrder);
  };

  const removeSelectedExercise = (index) => {
    const newList = [...selectedExercises];
    newList.splice(index, 1);
    setSelectedExercises(newList);
  };

  // --- CARDIO LOGIC ---
  const addCardioToRoutine = () => {
    if (!cardioInput.duration) return alert("Duration required");
    const newCardio = {
      id: Date.now(),
      type: cardioInput.type,
      duration: cardioInput.duration,
      distance: cardioInput.distance
    };
    setRoutineCardio([...routineCardio, newCardio]);
    setCardioInput({ type: 'Run', duration: '', distance: '' }); 
  };

  const removeCardioFromRoutine = (id) => {
    setRoutineCardio(routineCardio.filter(c => c.id !== id));
  };

  // --- MAIN FORM LOGIC ---
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

  const handleEdit = (routine) => {
    setEditingId(routine.id);
    setSelectedDay(routine.day);
    setRoutineCardio(routine.cardio || []);

    if ((!routine.exercises || routine.exercises.length === 0) && (!routine.cardio || routine.cardio.length === 0)) {
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
    setRoutineCardio([]);
    setSelectedDay(DAYS[0]);
    setIsRestDay(false);
  };

  const handleSave = async () => {
    if (!routineName) return alert("Name required");
    if (!isRestDay && selectedExercises.length === 0 && routineCardio.length === 0) {
      return alert("Select exercises, add cardio, or mark as Rest Day");
    }
    
    const exercisesToSave = selectedExercises.map(ex => ({
      id: ex.id,
      sets: ex.targetSets,
      reps: ex.targetReps
    }));

    await saveRoutine({
      id: editingId, 
      day: selectedDay,
      name: routineName,
      exercises: exercisesToSave,
      cardio: routineCardio
    });
    
    handleCancelEdit();
    loadData();
    alert(editingId ? "Routine Updated!" : `Saved routine for ${selectedDay}`);
  };

  const handleDelete = async (id) => {
    if (confirm("Delete this routine?")) {
      await deleteRoutine(id);
      if (editingId === id) handleCancelEdit();
      loadData();
    }
  };

  if (loading) return <div className="text-center pt-20 text-zinc-500 animate-pulse">Loading...</div>;

  return (
    <div className="max-w-md mx-auto text-white pb-20">
      <h2 className="text-xl font-bold mb-4 text-gray-300">
        {editingId ? 'Edit Routine' : 'Routine Builder'}
      </h2>

      <div className={`p-4 rounded-lg border mb-8 transition-colors ${editingId ? 'bg-zinc-800 border-blue-500/50' : 'bg-zinc-900 border-zinc-800'}`}>
        
        {/* Day Selector */}
        <label className="block text-xs text-zinc-500 uppercase font-bold mb-2">Day of Week</label>
        <div className="grid grid-cols-4 gap-2 mb-6">
          {DAYS.map(day => (
            <button key={day} onClick={() => setSelectedDay(day)} className={`py-2 rounded text-xs font-bold uppercase transition-all border ${selectedDay === day ? 'bg-white text-black border-white' : 'bg-black text-zinc-500 border-zinc-800 hover:border-zinc-600'}`}>
              {day.slice(0, 3)}
            </button>
          ))}
        </div>

        {/* Rest Day Toggle */}
        <div onClick={handleRestToggle} className={`flex items-center gap-3 p-3 rounded mb-4 cursor-pointer border ${isRestDay ? 'bg-green-900/20 border-green-500/50' : 'bg-black border-zinc-800'}`}>
          <div className={`w-5 h-5 rounded border flex items-center justify-center ${isRestDay ? 'bg-green-500 border-green-500' : 'border-zinc-600'}`}>
            {isRestDay && <span className="text-black text-xs font-bold">✓</span>}
          </div>
          <span className={isRestDay ? 'text-green-400 font-bold' : 'text-gray-400'}>Set as Rest Day</span>
        </div>

        <div className={isRestDay ? 'opacity-30 pointer-events-none grayscale' : ''}>
          <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Routine Name</label>
          <input type="text" value={routineName} onChange={(e) => setRoutineName(e.target.value)} placeholder="e.g. Heavy Legs" className="w-full p-2 mb-4 rounded bg-black border border-zinc-700 text-white outline-none focus:border-white transition" />

          {/* Cardio */}
          <div className="mb-6 p-3 bg-blue-900/10 border border-blue-900/30 rounded-lg">
            <label className="block text-xs text-blue-400 uppercase font-bold mb-2">Planned Cardio</label>
            {routineCardio.length > 0 && (
                <div className="space-y-2 mb-3">
                    {routineCardio.map(c => (
                        <div key={c.id} className="flex justify-between items-center bg-black/50 p-2 rounded border border-blue-900/30">
                            <span className="text-sm font-bold text-gray-300">{c.type} <span className="text-zinc-500 font-normal">({c.duration}m)</span></span>
                            <button onClick={() => removeCardioFromRoutine(c.id)} className="text-red-500 text-xs">✕</button>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex gap-2">
                <select value={cardioInput.type} onChange={(e) => setCardioInput({...cardioInput, type: e.target.value})} className="bg-black border border-zinc-700 rounded p-2 text-white text-xs w-24">
                    {CARDIO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="number" placeholder="Min" value={cardioInput.duration} onChange={(e) => setCardioInput({...cardioInput, duration: e.target.value})} className="bg-black border border-zinc-700 rounded p-2 text-white text-xs w-16" />
                <button onClick={addCardioToRoutine} className="bg-blue-600 text-white font-bold px-3 rounded text-xs hover:bg-blue-500">+</button>
            </div>
          </div>

          {/* --- SECTION 1: SELECTED EXERCISES (REORDERABLE) --- */}
          {selectedExercises.length > 0 && (
            <div className="mb-6">
                <label className="text-xs text-blue-400 uppercase font-bold mb-2 block">Routine Order</label>
                <div className="space-y-2">
                    {selectedExercises.map((ex, idx) => (
                        <div key={`${ex.id}-${idx}`} className="bg-zinc-800 p-3 rounded border border-zinc-700 flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-zinc-500 w-4">{idx + 1}.</span>
                                    <span className="font-bold text-white text-sm">{ex.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Reorder Buttons */}
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={() => moveExercise(idx, -1)}
                                            className={`w-6 h-6 rounded bg-black flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition ${idx === 0 ? 'opacity-30 pointer-events-none' : ''}`}
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
                                        </button>
                                        <button 
                                            onClick={() => moveExercise(idx, 1)}
                                            className={`w-6 h-6 rounded bg-black flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition ${idx === selectedExercises.length - 1 ? 'opacity-30 pointer-events-none' : ''}`}
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </button>
                                    </div>
                                    <div className="w-px h-4 bg-zinc-600 mx-1"></div>
                                    <button onClick={() => removeSelectedExercise(idx)} className="text-red-500 hover:text-red-400">✕</button>
                                </div>
                            </div>
                            
                            {/* Targets Row */}
                            <div className="flex gap-4 pl-7">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Sets</span>
                                    <input type="number" value={ex.targetSets} onChange={(e) => updateTarget(ex.id, 'targetSets', e.target.value)} className="w-12 bg-black border border-zinc-600 rounded p-1 text-xs text-center text-white outline-none focus:border-blue-500" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Reps</span>
                                    <input type="number" value={ex.targetReps} onChange={(e) => updateTarget(ex.id, 'targetReps', e.target.value)} className="w-12 bg-black border border-zinc-600 rounded p-1 text-xs text-center text-white outline-none focus:border-blue-500" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          )}

          {/* --- SECTION 2: EXERCISE LIBRARY (ADDER) --- */}
          <div className="flex justify-between items-end mb-2 pt-4 border-t border-zinc-800">
            <label className="text-xs text-gray-500 uppercase font-bold">Exercise Library</label>
            <button onClick={() => setShowNewExForm(!showNewExForm)} className="text-[10px] bg-zinc-800 text-blue-400 border border-blue-900/30 px-2 py-1 rounded hover:bg-zinc-700">
                {showNewExForm ? 'Cancel' : '+ Create Custom'}
            </button>
          </div>

          {/* New Custom Exercise Form */}
          {showNewExForm && (
            <div className="bg-black border border-blue-500/50 p-3 rounded mb-4 animate-fade-in">
                <label className="text-[10px] text-blue-400 font-bold block mb-1">Name</label>
                <input type="text" value={newExName} onChange={e => setNewExName(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white text-sm mb-2" placeholder="e.g. Bulgarian Split Squat" />
                <label className="text-[10px] text-blue-400 font-bold block mb-1">Category</label>
                <select value={newExCat} onChange={e => setNewExCat(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white text-sm mb-3">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={handleCreateExercise} className="w-full bg-blue-600 text-white font-bold py-2 rounded text-xs">Create Exercise</button>
            </div>
          )}

          {/* The Library List */}
          <div className="max-h-64 overflow-y-auto space-y-1 mb-4 border border-zinc-800 p-2 rounded bg-black/50">
            {allExercises.map(ex => {
              const isSelected = selectedExercises.some(item => String(item.id) === String(ex.id));
              const isCustom = !String(ex.id).startsWith('ex_');

              return (
                <div key={ex.id} className={`p-2 rounded transition flex justify-between items-center group ${isSelected ? 'opacity-50' : 'hover:bg-zinc-900 cursor-pointer'}`} onClick={() => !isSelected && toggleExercise(ex)}>
                    <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-zinc-600 border-zinc-600' : 'border-zinc-500'}`}>
                            {isSelected && <span className="text-black text-[9px]">✓</span>}
                        </div>
                        <span className={isSelected ? 'text-zinc-500' : 'text-gray-300 font-bold'}>{ex.name}</span>
                    </div>
                    {isCustom && !isSelected && (
                        <button onClick={(e) => handleDeleteExercise(e, ex.id)} className="text-zinc-600 hover:text-red-500 px-2">✕</button>
                    )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3">
            {editingId && <button onClick={handleCancelEdit} className="flex-1 bg-zinc-700 text-white font-bold py-3 rounded hover:bg-zinc-600 transition uppercase tracking-widest text-xs">Cancel</button>}
            <button onClick={handleSave} className={`flex-[2] text-black font-bold py-3 rounded transition uppercase tracking-widest text-xs ${editingId ? 'bg-blue-400 hover:bg-blue-300' : 'bg-white hover:bg-gray-200'}`}>{editingId ? 'Update Routine' : 'Save Routine'}</button>
        </div>
      </div>
      
      {/* Read-Only Schedule List */}
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Your Schedule</h3>
      <div className="space-y-3">
        {routines.sort((a,b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day)).map(routine => {
            const hasCardio = routine.cardio && routine.cardio.length > 0;
            const isRest = (!routine.exercises || routine.exercises.length === 0) && !hasCardio;
            return (
              <div key={routine.id} className={`bg-zinc-900/50 border p-3 rounded flex justify-between items-center ${editingId === routine.id ? 'border-blue-500 bg-blue-900/10' : 'border-zinc-800'}`}>
                <div>
                  <span className="text-xs text-blue-400 font-bold uppercase block">{routine.day}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-bold text-lg">{routine.name}</span>
                    {hasCardio && <span className="bg-blue-900/40 text-blue-300 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Cardio</span>}
                    {isRest && <span className="bg-zinc-800 text-gray-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Rest</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => handleEdit(routine)} className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded transition">Edit</button>
                    <button onClick={() => handleDelete(routine.id)} className="text-xs bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/50 px-3 py-2 rounded transition">✕</button>
                </div>
              </div>
            );
        })}
      </div>
    </div>
  );
}