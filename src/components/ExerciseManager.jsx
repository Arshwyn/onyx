// src/components/ExerciseManager.jsx
import React, { useState, useEffect } from 'react';
import { getExercises, addExercise } from '../dataManager';

export default function ExerciseManager() {
  const [exercises, setExercises] = useState([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    setExercises(getExercises());
  }, []);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!name || !category) return;
    const updated = addExercise(name, category);
    setExercises(updated);
    setName('');
    setCategory('');
  };

  return (
    <div className="max-w-md mx-auto text-white">
      <h2 className="text-xl font-bold mb-4 text-gray-300">Database</h2>

      {/* Input Form */}
      <form onSubmit={handleAdd} className="bg-zinc-900 p-4 rounded-lg mb-6 border border-zinc-800">
        <div className="flex flex-col gap-3">
          <input 
            type="text" 
            placeholder="Exercise Name..." 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="p-3 rounded bg-black border border-zinc-700 focus:border-white outline-none text-white placeholder-gray-600"
          />
          
          <select 
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="p-3 rounded bg-black border border-zinc-700 focus:border-white outline-none text-white text-sm"
          >
            <option value="">Select Category</option>
            <option value="Chest">Chest</option>
            <option value="Back">Back</option>
            <option value="Legs">Legs</option>
            <option value="Shoulders">Shoulders</option>
            <option value="Arms">Arms</option>
            <option value="Core">Core</option>
          </select>

          <button 
            type="submit" 
            className="bg-white text-black font-bold py-3 rounded hover:bg-gray-200 transition mt-2 uppercase tracking-widest text-xs"
          >
            Add
          </button>
        </div>
      </form>

      {/* Exercise List */}
      <div className="space-y-2">
        {exercises.map((ex) => (
          <div key={ex.id} className="flex justify-between items-center bg-zinc-900/50 p-3 rounded border border-zinc-800/50">
            <span className="font-medium text-gray-200">{ex.name}</span>
            <span className="text-xs text-zinc-500 uppercase font-bold tracking-wider">
              {ex.category}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}