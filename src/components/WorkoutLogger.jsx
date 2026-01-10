import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { getExercises, addLog, addCardioLog, getLogs } from '../dataManager';
import ConfirmModal from './ConfirmModal'; 
import PlateCalculator from './PlateCalculator'; 

const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function WorkoutLogger() {
  const [mode, setMode] = useState('lifting');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, isDestructive: false });
  const [weightUnit, setWeightUnit] = useState('lbs'); 
  const [distUnit, setDistUnit] = useState('mi'); 

  // Calculator State
  const [showCalc, setShowCalc] = useState(false);
  const [calcInitWeight, setCalcInitWeight] = useState('');

  const [exercises, setExercises] = useState([]);
  const [exerciseId, setExerciseId] = useState('');
  const [personalRecords, setPersonalRecords] = useState({}); 
  
  const [date, setDate] = useState(getLocalDate());
  const [sets, setSets] = useState([{ weight: '', reps: '' }]);

  const [cardioType, setCardioType] = useState('Run');
  const [cardioDuration, setCardioDuration] = useState('');
  const [cardioDistance, setCardioDistance] = useState('');

  const CARDIO_TYPES = ['Run', 'Walk', 'Cycle', 'Treadmill', 'Stairmaster', 'Rowing', 'Elliptical', 'HIIT', 'Other'];

  useEffect(() => {
    const loadData = async () => {
      try {
          const [loadedEx, allLogs] = await Promise.all([getExercises(), getLogs()]);
          setExercises(loadedEx);
          if (loadedEx.length > 0) setExerciseId(prev => prev || loadedEx[0].id);

          const prMap = {};
          loadedEx.forEach(ex => {
            const pastLogs = allLogs.filter(l => String(l.exercise_id || l.exerciseId) === String(ex.id));
            let max = 0;
            pastLogs.forEach(log => {
                if (log.sets) {
                    log.sets.forEach(s => {
                        const w = parseFloat(s.weight);
                        if (w > max) max = w;
                    });
                }
            });
            prMap[ex.id] = max;
          });
          setPersonalRecords(prMap);
      } catch (error) {
          console.error("Error loading logger data", error);
      }
    };
    loadData();

    const loadSettings = () => {
        setWeightUnit((localStorage.getItem('onyx_unit_weight') || 'lbs').toLowerCase());
        setDistUnit((localStorage.getItem('onyx_unit_distance') || 'mi').toLowerCase());
    };
    loadSettings();
    window.addEventListener('storage', loadSettings);
    return () => window.removeEventListener('storage', loadSettings);
  }, []);

  const openConfirm = (title, message, onConfirm, isDestructive = false) => {
    setModalConfig({ isOpen: true, title, message, onConfirm, isDestructive });
  };

  const openCalculator = (weightVal) => {
    setCalcInitWeight(weightVal);
    setShowCalc(true);
  };

  const handleAddSet = () => { setSets([...sets, { weight: '', reps: '' }]); };
  const handleSetChange = (index, field, value) => {
    const newSets = [...sets];
    newSets[index][field] = value;
    setSets(newSets);
  };
  const handleRemoveSet = (index) => {
    const setToRemove = sets[index];
    const hasData = setToRemove.weight || setToRemove.reps;
    const remove = () => { const newSets = sets.filter((_, i) => i !== index); setSets(newSets); };
    if (hasData) { openConfirm("Remove Set?", "This set has data. Are you sure you want to remove it?", remove, true); } else { remove(); }
  };

  const saveLift = async () => {
    const validSets = sets.filter(s => s.weight && s.reps);
    if (validSets.length === 0) { openConfirm("Missing Data", "Please enter weight and reps for at least one set."); return; }
    
    setIsSubmitting(true);
    try {
      const currentMax = Math.max(...validSets.map(s => parseFloat(s.weight) || 0));
      const oldMax = personalRecords[exerciseId] || 0;

      if (currentMax > oldMax && oldMax > 0) {
        const confettiEnabled = localStorage.getItem('onyx_show_confetti') !== 'false';
        if (confettiEnabled) {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#22c55e', '#ffffff', '#fbbf24']
            });
        }
      }

      await addLog(date, exerciseId, validSets);
      
      if (currentMax > oldMax) {
        setPersonalRecords(prev => ({ ...prev, [exerciseId]: currentMax }));
      }

      openConfirm("Workout Logged", "Great work! Your session has been saved to history.", () => { setSets([{ weight: '', reps: '' }]); }, false);
    } catch (err) { openConfirm("Error", "Could not save workout. Please try again.", null, true); } finally { setIsSubmitting(false); }
  };

  const saveCardio = async () => {
    if (!cardioDuration) { openConfirm("Missing Data", "Duration is required to log cardio."); return; }
    setIsSubmitting(true);
    try {
      const dist = cardioDistance === '' ? null : cardioDistance;
      await addCardioLog(date, cardioType, cardioDuration, dist);
      openConfirm("Cardio Logged", "Nice endurance! Your session has been saved.", () => { setCardioDuration(''); setCardioDistance(''); }, false);
    } catch (err) { openConfirm("Error", "Could not save cardio. Please try again.", null, true); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="w-full max-w-md mx-auto text-white overflow-x-hidden">
      <ConfirmModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} onConfirm={modalConfig.onConfirm} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} isDestructive={modalConfig.isDestructive} />
      
      <PlateCalculator isOpen={showCalc} onClose={() => setShowCalc(false)} initialWeight={calcInitWeight} unit={weightUnit} />

      <h2 className="text-xl font-bold mb-4 text-gray-300">Quick Log</h2>
      <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800 mb-6">
        <button onClick={() => setMode('lifting')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded transition ${mode === 'lifting' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Lifting</button>
        <button onClick={() => setMode('cardio')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded transition ${mode === 'cardio' ? 'bg-blue-900/50 text-blue-200' : 'text-zinc-500 hover:text-zinc-300'}`}>Cardio</button>
      </div>

      {mode === 'lifting' && (
        <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800">
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1 uppercase font-bold">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-2 text-white" />
          </div>
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1 uppercase font-bold">Exercise</label>
            <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-2 text-white outline-none">
              {exercises.map(ex => (<option key={ex.id} value={ex.id}>{ex.name}</option>))}
            </select>
          </div>
          <div className="space-y-2 mb-4">
            <label className="block text-xs text-gray-500 mb-1 uppercase font-bold">Sets</label>
            {sets.map((set, index) => (
              <div key={index} className="flex gap-2">
                <div className="flex-1 relative">
                    <input type="number" placeholder={weightUnit} value={set.weight} onChange={(e) => handleSetChange(index, 'weight', e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-2 text-white" />
                    <button onClick={() => openCalculator(set.weight)} className="absolute right-1 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-blue-400 p-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                    </button>
                </div>
                <div className="flex-1"><input type="number" placeholder="reps" value={set.reps} onChange={(e) => handleSetChange(index, 'reps', e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-2 text-white" /></div>
                <button onClick={() => handleRemoveSet(index)} className="text-red-500 px-2">✕</button>
              </div>
            ))}
            <button onClick={handleAddSet} className="text-xs text-blue-400 hover:text-blue-300 font-bold">+ Add Set</button>
          </div>
          <button onClick={saveLift} disabled={isSubmitting} className={`w-full font-bold py-3 rounded transition uppercase tracking-widest text-xs ${isSubmitting ? 'bg-zinc-600 text-zinc-400' : 'bg-white text-black hover:bg-gray-200'}`}>{isSubmitting ? 'Saving...' : 'Log Workout'}</button>
        </div>
      )}

      {mode === 'cardio' && (
        <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 animate-fade-in">
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1 uppercase font-bold">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-2 text-white" />
          </div>
          <div className="mb-4">
            <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Type</label>
            <select value={cardioType} onChange={(e) => setCardioType(e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-2 text-white outline-none">{CARDIO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
          </div>
          <div className="flex gap-3 mb-6">
            <div className="flex-1 min-w-0"><label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Duration (min)</label><input type="number" value={cardioDuration} onChange={(e) => setCardioDuration(e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-2 text-white outline-none" placeholder="0" /></div>
            <div className="flex-1 min-w-0"><label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Distance (opt)</label><input type="number" value={cardioDistance} onChange={(e) => setCardioDistance(e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-2 text-white outline-none" placeholder={distUnit} /></div>
          </div>
          <button onClick={saveCardio} disabled={isSubmitting} className={`w-full font-bold py-3 rounded transition uppercase tracking-widest text-xs ${isSubmitting ? 'bg-zinc-600 text-zinc-400' : 'bg-white text-black hover:bg-gray-200'}`}>{isSubmitting ? 'Saving...' : 'Log Cardio'}</button>
        </div>
      )}
    </div>
  );
}