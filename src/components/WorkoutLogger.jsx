import React, { useState, useEffect } from 'react';
import { getExercises, addLog, addCardioLog } from '../dataManager';

export default function WorkoutLogger() {
  const [mode, setMode] = useState('lifting');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // --- SETTINGS STATE ---
  const [weightUnit, setWeightUnit] = useState('lbs'); // Default lowercase

  const [exercises, setExercises] = useState([]);
  const [exerciseId, setExerciseId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [sets, setSets] = useState([{ weight: '', reps: '' }]);

  const [cardioType, setCardioType] = useState('Run');
  const [cardioDuration, setCardioDuration] = useState('');
  const [cardioDistance, setCardioDistance] = useState('');

  const CARDIO_TYPES = ['Run', 'Walk', 'Cycle', 'Treadmill', 'Stairmaster', 'Rowing', 'Elliptical', 'HIIT', 'Other'];

  useEffect(() => {
    const fetchEx = async () => {
      const loaded = await getExercises();
      setExercises(loaded);
      if (loaded.length > 0) setExerciseId(loaded[0].id);
    };
    fetchEx();

    // Load Settings (Force lowercase)
    const loadSettings = () => {
        setWeightUnit((localStorage.getItem('onyx_unit_weight') || 'lbs').toLowerCase());
    };
    loadSettings();
    window.addEventListener('storage', loadSettings);
    return () => window.removeEventListener('storage', loadSettings);
  }, []);

  const handleAddSet = () => {
    setSets([...sets, { weight: '', reps: '' }]);
  };

  const handleSetChange = (index, field, value) => {
    const newSets = [...sets];
    newSets[index][field] = value;
    setSets(newSets);
  };

  const handleRemoveSet = (index) => {
    const newSets = sets.filter((_, i) => i !== index);
    setSets(newSets);
  };

  const saveLift = async () => {
    const validSets = sets.filter(s => s.weight && s.reps);
    if (validSets.length === 0) return alert("Add at least one set");

    setIsSubmitting(true);
    try {
      await addLog(date, exerciseId, validSets);
      alert("Workout Logged!");
      setSets([{ weight: '', reps: '' }]); 
    } catch (err) {
      alert("Error saving workout. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveCardio = async () => {
    if (!cardioDuration) return alert("Duration is required");
    
    setIsSubmitting(true);
    try {
      await addCardioLog(date, cardioType, cardioDuration, cardioDistance);
      alert("Cardio Logged!");
      setCardioDuration('');
      setCardioDistance('');
    } catch (err) {
      alert("Error saving cardio. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto text-white overflow-x-hidden">
      <h2 className="text-xl font-bold mb-4 text-gray-300">Quick Log</h2>

      <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800 mb-6">
        <button 
          onClick={() => setMode('lifting')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded transition ${
            mode === 'lifting' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Lifting
        </button>
        <button 
          onClick={() => setMode('cardio')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded transition ${
            mode === 'cardio' ? 'bg-blue-900/50 text-blue-200' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Cardio
        </button>
      </div>

      {mode === 'lifting' && (
        <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800">
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1 uppercase font-bold">Date</label>
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-black border border-zinc-700 rounded p-2 text-white"
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1 uppercase font-bold">Exercise</label>
            <select 
              value={exerciseId} 
              onChange={(e) => setExerciseId(e.target.value)}
              className="w-full bg-black border border-zinc-700 rounded p-2 text-white outline-none"
            >
              {exercises.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2 mb-4">
            <label className="block text-xs text-gray-500 mb-1 uppercase font-bold">Sets</label>
            {sets.map((set, index) => (
              <div key={index} className="flex gap-2">
                {/* UPDATED: Lowercase Placeholder */}
                <input 
                  type="number" 
                  placeholder={weightUnit.toLowerCase()} 
                  value={set.weight}
                  onChange={(e) => handleSetChange(index, 'weight', e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded p-2 text-white"
                />
                <input 
                  type="number" 
                  placeholder="reps" 
                  value={set.reps}
                  onChange={(e) => handleSetChange(index, 'reps', e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded p-2 text-white"
                />
                <button onClick={() => handleRemoveSet(index)} className="text-red-500 px-2">✕</button>
              </div>
            ))}
            <button onClick={handleAddSet} className="text-xs text-blue-400 hover:text-blue-300 font-bold">
              + Add Set
            </button>
          </div>

          <button 
            onClick={saveLift}
            disabled={isSubmitting}
            className={`w-full font-bold py-3 rounded transition uppercase tracking-widest text-xs ${
                isSubmitting ? 'bg-zinc-600 text-zinc-400' : 'bg-white text-black hover:bg-gray-200'
            }`}
          >
            {isSubmitting ? 'Saving...' : 'Log Workout'}
          </button>
        </div>
      )}

      {mode === 'cardio' && (
        <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 animate-fade-in">
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1 uppercase font-bold">Date</label>
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-black border border-zinc-700 rounded p-2 text-white"
            />
          </div>

          <div className="mb-4">
            <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Type</label>
            <select 
              value={cardioType}
              onChange={(e) => setCardioType(e.target.value)}
              className="w-full bg-black border border-zinc-700 rounded p-2 text-white outline-none"
            >
              {CARDIO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="flex gap-3 mb-6">
            <div className="flex-1 min-w-0">
              <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Duration (min)</label>
              <input 
                type="number" 
                value={cardioDuration}
                onChange={(e) => setCardioDuration(e.target.value)}
                className="w-full bg-black border border-zinc-700 rounded p-2 text-white outline-none"
                placeholder="0"
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Distance (opt)</label>
              <input 
                type="number" 
                value={cardioDistance}
                onChange={(e) => setCardioDistance(e.target.value)}
                className="w-full bg-black border border-zinc-700 rounded p-2 text-white outline-none"
                placeholder="-"
              />
            </div>
          </div>

          <button 
            onClick={saveCardio}
            disabled={isSubmitting}
            className={`w-full font-bold py-3 rounded transition uppercase tracking-widest text-xs ${
                isSubmitting ? 'bg-zinc-600 text-zinc-400' : 'bg-white text-black hover:bg-gray-200'
            }`}
          >
            {isSubmitting ? 'Saving...' : 'Log Cardio'}
          </button>
        </div>
      )}
    </div>
  );
}