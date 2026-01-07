import React, { useState, useEffect } from 'react';
import { getExercises, addLog } from '../dataManager';

export default function WorkoutLogger() {
  // State for form data
  const [exercises, setExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // Default to today
  const [sets, setSets] = useState([{ weight: '', reps: '' }]); // Start with one empty set

  useEffect(() => {
    setExercises(getExercises());
  }, []);

  // Add a new row for another set
  const addSetRow = () => {
    setSets([...sets, { weight: '', reps: '' }]);
  };

  // Update specific set data
  const handleSetChange = (index, field, value) => {
    const updatedSets = [...sets];
    updatedSets[index][field] = value;
    setSets(updatedSets);
  };

  const handleSave = () => {
    if (!selectedExercise) return alert("Please select an exercise");
    
    // Filter out empty sets to avoid saving junk
    const validSets = sets.filter(s => s.weight && s.reps);
    if (validSets.length === 0) return alert("Please add at least one set");

    addLog(date, selectedExercise, validSets);
    
    // Reset form (keep date, clear sets)
    setSets([{ weight: '', reps: '' }]);
    alert("Workout Saved!");
  };

  return (
    <div className="max-w-md mx-auto text-white">
      <h2 className="text-xl font-bold mb-4 text-gray-300">Log Workout</h2>

      <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 space-y-4">
        
        {/* Date Picker */}
        <div>
          <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Date</label>
          <input 
            type="date" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-3 rounded bg-black border border-zinc-700 text-white outline-none"
          />
        </div>

        {/* Exercise Selector */}
        <div>
          <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Exercise</label>
          <select 
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
            className="w-full p-3 rounded bg-black border border-zinc-700 text-white outline-none"
          >
            <option value="">Select Movement...</option>
            {exercises.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.name}</option>
            ))}
          </select>
        </div>

        {/* Sets & Reps Inputs */}
        <div>
          <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Sets</label>
          {sets.map((set, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input 
                type="number" 
                placeholder="lbs" 
                value={set.weight}
                onChange={(e) => handleSetChange(index, 'weight', e.target.value)}
                className="w-1/2 p-3 rounded bg-black border border-zinc-700 text-white outline-none placeholder-zinc-600"
              />
              <input 
                type="number" 
                placeholder="reps" 
                value={set.reps}
                onChange={(e) => handleSetChange(index, 'reps', e.target.value)}
                className="w-1/2 p-3 rounded bg-black border border-zinc-700 text-white outline-none placeholder-zinc-600"
              />
            </div>
          ))}
          <button 
            onClick={addSetRow}
            className="text-xs text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider mt-1"
          >
            + Add Set
          </button>
        </div>

        <button 
          onClick={handleSave}
          className="w-full bg-white text-black font-bold py-3 rounded hover:bg-gray-200 transition uppercase tracking-widest text-xs mt-4"
        >
          Save Log
        </button>

      </div>
    </div>
  );
}