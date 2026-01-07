import React, { useState, useEffect } from 'react';
import { getLogs, getExercises, deleteLog, updateLog } from '../dataManager';

export default function HistoryView() {
  const [logs, setLogs] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [exerciseMap, setExerciseMap] = useState({});
  
  // State for the "Edit Mode" Modal
  const [editingLog, setEditingLog] = useState(null); // If not null, modal is open

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const loadedLogs = getLogs();
    const loadedExercises = getExercises();
    
    // Create lookup map
    const map = {};
    loadedExercises.forEach(ex => map[ex.id] = ex.name);

    // Sort logs: Newest first
    loadedLogs.sort((a, b) => new Date(b.date) - new Date(a.date));

    setLogs(loadedLogs);
    setExercises(loadedExercises);
    setExerciseMap(map);
  };

  // --- ACTIONS ---

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this workout?")) {
      deleteLog(id);
      loadData(); // Refresh list
    }
  };

  const startEditing = (log) => {
    // Create a deep copy of the log so we don't mutate state directly while editing
    setEditingLog(JSON.parse(JSON.stringify(log))); 
  };

  const saveEdit = () => {
    if (!editingLog) return;
    
    // Basic validation
    const validSets = editingLog.sets.filter(s => s.weight && s.reps);
    if (validSets.length === 0) return alert("Must have at least one set.");

    const finalLog = { ...editingLog, sets: validSets };
    updateLog(finalLog);
    
    setEditingLog(null); // Close modal
    loadData(); // Refresh list
  };

  // --- HELPERS FOR EDIT FORM ---
  
  const updateEditSet = (index, field, value) => {
    const newSets = [...editingLog.sets];
    newSets[index][field] = value;
    setEditingLog({ ...editingLog, sets: newSets });
  };

  const addEditSet = () => {
    setEditingLog({
      ...editingLog,
      sets: [...editingLog.sets, { weight: '', reps: '' }]
    });
  };

  const removeEditSet = (index) => {
    const newSets = editingLog.sets.filter((_, i) => i !== index);
    setEditingLog({ ...editingLog, sets: newSets });
  };

  // --- EXPORT CSV (Same as before) ---
  const downloadCSV = () => {
    let csv = 'Date,Exercise,Weight,Reps\n';
    logs.forEach(log => {
      const exName = exerciseMap[log.exerciseId] || 'Unknown';
      log.sets.forEach(set => {
        csv += `${log.date},"${exName}",${set.weight},${set.reps}\n`;
      });
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'onyx_data.csv';
    a.click();
  };

  return (
    <div className="max-w-md mx-auto text-white pb-10">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-300">History</h2>
        <button onClick={downloadCSV} className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded border border-zinc-700 transition">
          Export CSV
        </button>
      </div>

      {/* List */}
      <div className="space-y-4">
        {logs.map((log) => (
          <div key={log.id} className="bg-zinc-900 rounded border border-zinc-800 overflow-hidden relative group">
            
            {/* Card Header */}
            <div className="bg-zinc-800/50 p-3 flex justify-between items-center">
              <div>
                <span className="font-bold text-gray-200 block">
                  {exerciseMap[log.exerciseId] || 'Unknown Exercise'}
                </span>
                <span className="text-xs text-zinc-500 font-mono">
                  {log.date}
                </span>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2">
                <button 
                  onClick={() => startEditing(log)}
                  className="text-xs bg-zinc-700 hover:bg-zinc-600 text-white px-2 py-1 rounded"
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleDelete(log.id)}
                  className="text-xs bg-red-900/30 hover:bg-red-900/50 text-red-400 px-2 py-1 rounded border border-red-900/50"
                >
                  Del
                </button>
              </div>
            </div>

            {/* Sets List */}
            <div className="p-3">
              {log.sets.map((set, idx) => (
                <div key={idx} className="grid grid-cols-3 text-sm text-gray-300 py-1 border-b border-zinc-800/50 last:border-0">
                  <span className="text-zinc-500 text-xs mt-1">SET {idx + 1}</span>
                  <span>{set.weight} <span className="text-xs text-zinc-600">lbs</span></span>
                  <span>{set.reps} <span className="text-xs text-zinc-600">reps</span></span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* --- EDIT MODAL --- */}
      {editingLog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 w-full max-w-sm rounded-xl border border-zinc-700 shadow-2xl p-4">
            <h3 className="text-lg font-bold mb-4 text-white">Edit Workout</h3>
            
            {/* Edit Date */}
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input 
                type="date" 
                value={editingLog.date}
                onChange={(e) => setEditingLog({ ...editingLog, date: e.target.value })}
                className="w-full bg-black border border-zinc-700 rounded p-2 text-white"
              />
            </div>

            {/* Edit Sets */}
            <div className="max-h-60 overflow-y-auto mb-4 space-y-2">
              <label className="block text-xs text-gray-500 mb-1">Sets</label>
              {editingLog.sets.map((set, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input 
                    type="number" 
                    value={set.weight} 
                    onChange={(e) => updateEditSet(index, 'weight', e.target.value)}
                    className="w-20 bg-black border border-zinc-700 rounded p-2 text-white text-sm"
                    placeholder="lbs"
                  />
                  <input 
                    type="number" 
                    value={set.reps} 
                    onChange={(e) => updateEditSet(index, 'reps', e.target.value)}
                    className="w-16 bg-black border border-zinc-700 rounded p-2 text-white text-sm"
                    placeholder="reps"
                  />
                  <button 
                    onClick={() => removeEditSet(index)}
                    className="text-red-500 text-xs hover:text-red-400 px-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button onClick={addEditSet} className="text-xs text-blue-400 hover:text-blue-300 font-bold mt-2">
                + Add Set
              </button>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 mt-4 pt-4 border-t border-zinc-800">
              <button 
                onClick={() => setEditingLog(null)}
                className="flex-1 bg-zinc-800 text-white py-2 rounded hover:bg-zinc-700 transition"
              >
                Cancel
              </button>
              <button 
                onClick={saveEdit}
                className="flex-1 bg-white text-black font-bold py-2 rounded hover:bg-gray-200 transition"
              >
                Save Changes
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}