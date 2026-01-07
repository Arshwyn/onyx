import React, { useState, useEffect } from 'react';
import { 
  getLogs, getExercises, deleteLog, updateLog,         // Lifting
  getCardioLogs, deleteCardioLog, updateCardioLog      // Cardio
} from '../dataManager';

export default function HistoryView() {
  const [loading, setLoading] = useState(true);
  const [combinedHistory, setCombinedHistory] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [exerciseMap, setExerciseMap] = useState({});
  
  // Edit Modal State
  const [editingLog, setEditingLog] = useState(null); 
  const CARDIO_TYPES = ['Run', 'Walk', 'Cycle', 'Treadmill', 'Stairmaster', 'Rowing', 'Elliptical', 'HIIT', 'Other'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    
    // Fetch data in parallel
    const [loadedLogs, loadedCardio] = await Promise.all([
      getLogs(),
      getCardioLogs()
    ]);
    
    const loadedExercises = await getExercises();
    
    // Create lookup map
    const map = {};
    loadedExercises.forEach(ex => map[ex.id] = ex.name);

    // 1. Tag Lifting Logs
    const liftingItems = loadedLogs.map(log => ({
      ...log,
      dataType: 'lift' 
    }));

    // 2. Tag Cardio Logs
    const cardioItems = loadedCardio.map(log => ({
      ...log,
      dataType: 'cardio' 
    }));

    // 3. Merge and Sort
    const allItems = [...liftingItems, ...cardioItems];
    allItems.sort((a, b) => new Date(b.date) - new Date(a.date));

    setCombinedHistory(allItems);
    setExercises(loadedExercises);
    setExerciseMap(map);
    setLoading(false);
  };

  // --- ACTIONS ---

  const handleDelete = async (item) => {
    const confirmMsg = item.dataType === 'lift' 
      ? "Delete this workout?" 
      : "Delete this cardio session?";
      
    if (window.confirm(confirmMsg)) {
      if (item.dataType === 'lift') {
        await deleteLog(item.id);
      } else {
        await deleteCardioLog(item.id);
      }
      loadData(); 
    }
  };

  const startEditing = (log) => {
    setEditingLog(JSON.parse(JSON.stringify(log))); 
  };

  const saveEdit = async () => {
    if (!editingLog) return;

    if (editingLog.dataType === 'lift') {
        // Lifting Save Logic
        const validSets = editingLog.sets.filter(s => s.weight && s.reps);
        if (validSets.length === 0) return alert("Must have at least one set.");
        const finalLog = { ...editingLog, sets: validSets };
        await updateLog(finalLog);
    } else {
        // Cardio Save Logic
        if (!editingLog.duration) return alert("Duration is required.");
        await updateCardioLog(editingLog);
    }

    setEditingLog(null); 
    loadData(); 
  };

  // --- HELPERS FOR LIFT EDITING ---
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

  const downloadCSV = () => {
    let csv = 'Type,Date,Activity,Duration/Weight,Distance/Reps\n';
    combinedHistory.forEach(item => {
      if (item.dataType === 'lift') {
        const exName = exerciseMap[item.exerciseId || item.exercise_id] || 'Unknown';
        // Handle potentially different set structure from DB
        const sets = item.sets || [];
        sets.forEach(set => {
          csv += `LIFT,${item.date},"${exName}",${set.weight},${set.reps}\n`;
        });
      } else {
        csv += `CARDIO,${item.date},"${item.type}",${item.duration},${item.distance || ''}\n`;
      }
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'onyx_history.csv';
    a.click();
  };

  if (loading) {
    return <div className="text-center pt-20 text-zinc-500 animate-pulse">Loading History...</div>;
  }

  return (
    <div className="max-w-md mx-auto text-white pb-10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-300">History</h2>
        <button onClick={downloadCSV} className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded border border-zinc-700 transition">
          Export CSV
        </button>
      </div>

      <div className="space-y-4">
        {combinedHistory.map((item) => {
          if (item.dataType === 'cardio') {
            return (
              <div key={`c-${item.id}`} className="bg-zinc-900/80 rounded border border-blue-900/30 overflow-hidden relative group">
                <div className="p-3 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                     <div className="bg-blue-900/20 text-blue-400 p-2 rounded-full"><span className="text-xs font-bold">C</span></div>
                     <div><span className="text-blue-400 font-bold block">{item.type}</span><span className="text-xs text-zinc-500 font-mono">{item.date}</span></div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                        <span className="block text-white font-bold">{item.duration} <span className="text-xs text-zinc-500 font-normal">min</span></span>
                        {item.distance && <span className="block text-xs text-zinc-400">{item.distance} dist</span>}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => startEditing(item)} className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-2 py-1 rounded transition border border-zinc-700">Edit</button>
                        <button onClick={() => handleDelete(item)} className="text-xs bg-red-900/20 hover:bg-red-900/40 text-red-400 px-2 py-1 rounded border border-red-900/50 transition">Del</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={`l-${item.id}`} className="bg-zinc-900 rounded border border-zinc-800 overflow-hidden relative group">
              <div className="bg-zinc-800/50 p-3 flex justify-between items-center">
                <div>
                  <span className="font-bold text-gray-200 block">{exerciseMap[item.exerciseId || item.exercise_id] || 'Unknown Exercise'}</span>
                  <span className="text-xs text-zinc-500 font-mono">{item.date}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEditing(item)} className="text-xs bg-zinc-700 hover:bg-zinc-600 text-white px-2 py-1 rounded transition">Edit</button>
                  <button onClick={() => handleDelete(item)} className="text-xs bg-red-900/30 hover:bg-red-900/50 text-red-400 px-2 py-1 rounded border border-red-900/50 transition">Del</button>
                </div>
              </div>
              <div className="p-3">
                {(item.sets || []).map((set, idx) => (
                  <div key={idx} className="grid grid-cols-3 text-sm text-gray-300 py-1 border-b border-zinc-800/50 last:border-0">
                    <span className="text-zinc-500 text-xs mt-1">SET {idx + 1}</span>
                    <span>{set.weight} <span className="text-xs text-zinc-600">lbs</span></span>
                    <span>{set.reps} <span className="text-xs text-zinc-600">reps</span></span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {editingLog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 w-full max-w-sm rounded-xl border border-zinc-700 shadow-2xl p-4 animate-fade-in">
            <h3 className="text-lg font-bold mb-4 text-white">Edit {editingLog.dataType === 'lift' ? 'Workout' : 'Cardio'}</h3>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input type="date" value={editingLog.date} onChange={(e) => setEditingLog({ ...editingLog, date: e.target.value })} className="w-full bg-black border border-zinc-700 rounded p-2 text-white" />
            </div>
            {editingLog.dataType === 'lift' ? (
                <div className="max-h-60 overflow-y-auto mb-4 space-y-2">
                    <label className="block text-xs text-gray-500 mb-1">Sets</label>
                    {editingLog.sets.map((set, index) => (
                        <div key={index} className="flex gap-2 items-center">
                        <input type="number" value={set.weight} onChange={(e) => updateEditSet(index, 'weight', e.target.value)} className="w-20 bg-black border border-zinc-700 rounded p-2 text-white text-sm" placeholder="lbs" />
                        <input type="number" value={set.reps} onChange={(e) => updateEditSet(index, 'reps', e.target.value)} className="w-16 bg-black border border-zinc-700 rounded p-2 text-white text-sm" placeholder="reps" />
                        <button onClick={() => removeEditSet(index)} className="text-red-500 text-xs px-2">✕</button>
                        </div>
                    ))}
                    <button onClick={addEditSet} className="text-xs text-blue-400 hover:text-blue-300 font-bold mt-2">+ Add Set</button>
                </div>
            ) : (
                <div className="space-y-4 mb-4">
                    <div><label className="block text-xs text-gray-500 mb-1">Type</label><select value={editingLog.type} onChange={(e) => setEditingLog({ ...editingLog, type: e.target.value })} className="w-full bg-black border border-zinc-700 rounded p-2 text-white outline-none">{CARDIO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    <div className="flex gap-3"><div className="flex-1"><label className="block text-xs text-gray-500 mb-1">Duration (min)</label><input type="number" value={editingLog.duration} onChange={(e) => setEditingLog({ ...editingLog, duration: e.target.value })} className="w-full bg-black border border-zinc-700 rounded p-2 text-white outline-none" /></div><div className="flex-1"><label className="block text-xs text-gray-500 mb-1">Distance</label><input type="number" value={editingLog.distance || ''} onChange={(e) => setEditingLog({ ...editingLog, distance: e.target.value })} className="w-full bg-black border border-zinc-700 rounded p-2 text-white outline-none" /></div></div>
                </div>
            )}
            <div className="flex gap-3 mt-4 pt-4 border-t border-zinc-800">
              <button onClick={() => setEditingLog(null)} className="flex-1 bg-zinc-800 text-white py-2 rounded hover:bg-zinc-700 transition">Cancel</button>
              <button onClick={saveEdit} className="flex-1 bg-white text-black font-bold py-2 rounded hover:bg-gray-200 transition">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}