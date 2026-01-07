import React, { useState, useEffect } from 'react';
import { 
  getBodyWeights, addBodyWeight, deleteBodyWeight, 
  getLogs, getExercises,
  getCircumferences, addCircumference, deleteCircumference 
} from '../dataManager';

export default function TrendsView() {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('exercises'); // 'exercises', 'bodyweight', 'measurements'
  
  // --- STATE: EXERCISES ---
  const [exercises, setExercises] = useState([]);
  const [selectedExId, setSelectedExId] = useState('');
  const [exerciseData, setExerciseData] = useState([]); 

  // --- STATE: BODY WEIGHT ---
  const [bodyData, setBodyData] = useState([]);
  const [inputWeight, setInputWeight] = useState('');
  const [inputDate, setInputDate] = useState(new Date().toISOString().split('T')[0]);

  // --- STATE: MEASUREMENTS ---
  const [measurementData, setMeasurementData] = useState([]); 
  const [filteredMeasurements, setFilteredMeasurements] = useState([]); 
  const [bodyPart, setBodyPart] = useState('Waist');
  const [inputMeasurement, setInputMeasurement] = useState('');
  const [measureDate, setMeasureDate] = useState(new Date().toISOString().split('T')[0]);

  const BODY_PARTS = ['Waist', 'Chest', 'Left Arm', 'Right Arm', 'Left Thigh', 'Right Thigh', 'Calves', 'Neck', 'Shoulders', 'Hips'];

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (mode === 'exercises' && selectedExId) {
      calculateExerciseTrend(selectedExId);
    }
    if (mode === 'measurements') {
      filterMeasurements(bodyPart);
    }
  }, [mode, selectedExId, bodyPart, measurementData]);

  const loadAllData = async () => {
    setLoading(true);
    const [bData, allEx, logs, mData] = await Promise.all([
      getBodyWeights(),
      getExercises(),
      getLogs(),
      getCircumferences() 
    ]);

    bData.sort((a, b) => new Date(a.date) - new Date(b.date));
    setBodyData(bData);

    setExercises(allEx);
    if (allEx.length > 0 && !selectedExId) setSelectedExId(allEx[0].id);

    setMeasurementData(mData);
    setLoading(false);
  };

  const calculateExerciseTrend = async (exId) => {
    const allLogs = await getLogs();
    const relevantLogs = allLogs.filter(l => String(l.exercise_id || l.exerciseId) === String(exId));
    
    const points = relevantLogs.map(log => {
      const sets = log.sets || [];
      const maxWeight = sets.reduce((max, set) => Math.max(max, parseFloat(set.weight) || 0), 0);
      return { id: log.id, date: log.date, weight: maxWeight };
    });

    points.sort((a, b) => new Date(a.date) - new Date(b.date));
    setExerciseData(points);
  };

  const filterMeasurements = (part) => {
    const filtered = measurementData
      .filter(m => m.body_part === part)
      .map(m => ({ ...m, weight: m.measurement })) 
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    setFilteredMeasurements(filtered);
  };

  const handleSaveMeasurement = async () => {
    if (!inputMeasurement) return;
    await addCircumference(measureDate, bodyPart, inputMeasurement);
    setInputMeasurement('');
    const mData = await getCircumferences();
    setMeasurementData(mData);
  };

  const handleDeleteMeasurement = async (id) => {
    if (confirm("Delete this measurement?")) {
      await deleteCircumference(id);
      const mData = await getCircumferences();
      setMeasurementData(mData);
    }
  };

  const handleSaveWeight = async () => {
    if (!inputWeight) return;
    await addBodyWeight(inputWeight, inputDate);
    setInputWeight('');
    const bData = await getBodyWeights();
    bData.sort((a, b) => new Date(a.date) - new Date(b.date));
    setBodyData(bData);
  };

  const handleDeleteWeight = async (id) => {
    if (confirm("Delete this entry?")) {
      await deleteBodyWeight(id);
      const bData = await getBodyWeights();
      bData.sort((a, b) => new Date(a.date) - new Date(b.date));
      setBodyData(bData);
    }
  };

  const renderChart = (dataPoints) => {
    if (dataPoints.length < 2) {
      return (
        <div className="p-8 text-center text-zinc-600 text-sm italic border border-dashed border-zinc-800 rounded-lg mb-6">
          Need at least 2 data points to show a trend.
        </div>
      );
    }

    const width = 100;
    const height = 50;
    const values = dataPoints.map(p => p.weight);
    const minVal = Math.min(...values) * 0.95; 
    const maxVal = Math.max(...values) * 1.05; 
    const range = maxVal - minVal || 1;

    const pathD = dataPoints.map((point, index) => {
      const x = (index / (dataPoints.length - 1)) * width;
      const y = height - ((point.weight - minVal) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 mb-6 relative">
        <h3 className="text-xs text-zinc-500 font-bold uppercase mb-4">
          Progress ({dataPoints.length} entries)
        </h3>
        <svg viewBox="0 0 100 50" className="w-full h-32 stroke-blue-400 stroke-2 fill-none overflow-visible">
          <polyline points={pathD} vectorEffect="non-scaling-stroke" />
          {dataPoints.map((p, i) => {
             const x = (i / (dataPoints.length - 1)) * width;
             const y = height - ((p.weight - minVal) / range) * height;
             return <circle cx={x} cy={y} r="1.5" className="fill-black stroke-white stroke-[0.5]" key={i} />
          })}
        </svg>
        <div className="flex justify-between text-[10px] text-zinc-600 mt-2 font-mono">
          <span>{dataPoints[0].date}</span>
          <span>{dataPoints[dataPoints.length - 1].date}</span>
        </div>
      </div>
    );
  };

  if (loading) return <div className="text-center pt-20 text-zinc-500 animate-pulse">Loading Trends...</div>;

  // FIXED: w-full overflow-x-hidden
  return (
    <div className="w-full max-w-md mx-auto text-white pb-20 overflow-x-hidden">
      
      <div className="mb-6 border-b border-zinc-800 pb-4">
        <h1 className="text-3xl font-black italic uppercase mb-4">Trends</h1>
        <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
          <button onClick={() => setMode('exercises')} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded transition ${mode === 'exercises' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Lifts</button>
          <button onClick={() => setMode('bodyweight')} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded transition ${mode === 'bodyweight' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Weight</button>
          <button onClick={() => setMode('measurements')} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded transition ${mode === 'measurements' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Measure</button>
        </div>
      </div>

      {mode === 'exercises' && (
        <div className="animate-fade-in">
          <div className="mb-6">
            <label className="block text-[10px] text-zinc-500 uppercase font-bold mb-2">Select Exercise</label>
            <select value={selectedExId} onChange={(e) => setSelectedExId(e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-3 text-white outline-none">
              {exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
          </div>
          {renderChart(exerciseData)}
          <div className="space-y-2">
             <h3 className="text-xs text-zinc-500 font-bold uppercase mb-2">Log History</h3>
             {[...exerciseData].reverse().map((entry, idx) => (
               <div key={idx} className="flex justify-between items-center bg-zinc-900/50 p-3 rounded border border-zinc-800/50">
                 <span className="text-zinc-400 text-xs font-mono">{entry.date}</span>
                 <span className="font-bold text-white">{entry.weight} <span className="text-xs text-zinc-600 font-normal">lbs</span></span>
               </div>
             ))}
          </div>
        </div>
      )}

      {mode === 'bodyweight' && (
        <div className="animate-fade-in">
          <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 mb-6">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Date</label>
                <input type="date" value={inputDate} onChange={(e) => setInputDate(e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-sm" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Weight</label>
                <input type="number" value={inputWeight} onChange={(e) => setInputWeight(e.target.value)} placeholder="lbs" className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-sm" />
              </div>
              <button onClick={handleSaveWeight} className="bg-white text-black font-bold px-4 py-2 rounded h-[38px] text-sm hover:bg-gray-200">Log</button>
            </div>
          </div>
          {renderChart(bodyData)}
          <div className="space-y-2">
            <h3 className="text-xs text-zinc-500 font-bold uppercase mb-2">History</h3>
            {[...bodyData].sort((a,b) => new Date(b.date) - new Date(a.date)).map(entry => (
              <div key={entry.id} className="flex justify-between items-center bg-zinc-900/50 p-3 rounded border border-zinc-800/50">
                <span className="text-zinc-400 text-xs font-mono">{entry.date}</span>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-white">{entry.weight} <span className="text-xs text-zinc-600 font-normal">lbs</span></span>
                  <button onClick={() => handleDeleteWeight(entry.id)} className="text-zinc-600 hover:text-red-500 transition">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === 'measurements' && (
        <div className="animate-fade-in">
          <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 mb-6">
            <div className="mb-3">
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Body Part</label>
                {/* FIXED: Added w-full */}
                <select value={bodyPart} onChange={(e) => setBodyPart(e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-sm outline-none">
                    {BODY_PARTS.map(part => <option key={part} value={part}>{part}</option>)}
                </select>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1 min-w-0"> {/* FIXED: min-w-0 */}
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Date</label>
                <input type="date" value={measureDate} onChange={(e) => setMeasureDate(e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-sm" />
              </div>
              <div className="flex-1 min-w-0"> {/* FIXED: min-w-0 */}
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Value</label>
                <input type="number" value={inputMeasurement} onChange={(e) => setInputMeasurement(e.target.value)} placeholder="in/cm" className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-sm" />
              </div>
              <button onClick={handleSaveMeasurement} className="bg-white text-black font-bold px-4 py-2 rounded h-[38px] text-sm hover:bg-gray-200">Log</button>
            </div>
          </div>

          {renderChart(filteredMeasurements)}

          <div className="space-y-2">
            <h3 className="text-xs text-zinc-500 font-bold uppercase mb-2">{bodyPart} History</h3>
            {[...filteredMeasurements].reverse().map(entry => (
              <div key={entry.id} className="flex justify-between items-center bg-zinc-900/50 p-3 rounded border border-zinc-800/50">
                <span className="text-zinc-400 text-xs font-mono">{entry.date}</span>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-white">{entry.measurement}</span>
                  <button onClick={() => handleDeleteMeasurement(entry.id)} className="text-zinc-600 hover:text-red-500 transition">✕</button>
                </div>
              </div>
            ))}
            {filteredMeasurements.length === 0 && <p className="text-zinc-600 text-sm italic">No records for {bodyPart}.</p>}
          </div>
        </div>
      )}
    </div>
  );
}