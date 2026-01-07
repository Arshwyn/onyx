import React, { useState, useEffect } from 'react';

export default function PlateCalculator({ isOpen, onClose, initialWeight, unit = 'lbs' }) {
  const [targetWeight, setTargetWeight] = useState(initialWeight || '');
  
  // New State: Default to standard bar (45/20), but allow changes
  const [baseWeight, setBaseWeight] = useState(unit === 'lbs' ? 45 : 20);
  
  const [plates, setPlates] = useState([]);
  const [remainder, setRemainder] = useState(0);

  // Common Bar Configurations for Quick Select
  const barOptions = unit === 'lbs' 
    ? [
        { label: 'None/Mach', weight: 0 },
        { label: 'EZ Bar', weight: 25 },
        { label: 'Womens', weight: 35 },
        { label: 'Standard', weight: 45 },
      ] 
    : [
        { label: 'None/Mach', weight: 0 },
        { label: 'EZ Bar', weight: 10 },
        { label: 'Womens', weight: 15 },
        { label: 'Standard', weight: 20 },
      ];

  const plateConfig = unit === 'lbs' 
    ? [
        { weight: 45, color: 'bg-blue-600', height: 'h-24' },
        { weight: 35, color: 'bg-yellow-500', height: 'h-20' },
        { weight: 25, color: 'bg-green-600', height: 'h-16' },
        { weight: 10, color: 'bg-gray-200', height: 'h-12' },
        { weight: 5,  color: 'bg-zinc-800', height: 'h-10' },
        { weight: 2.5, color: 'bg-zinc-600', height: 'h-8' },
      ]
    : [
        { weight: 25, color: 'bg-red-600', height: 'h-24' },
        { weight: 20, color: 'bg-blue-600', height: 'h-22' },
        { weight: 15, color: 'bg-yellow-500', height: 'h-20' },
        { weight: 10, color: 'bg-green-600', height: 'h-16' },
        { weight: 5,  color: 'bg-white', height: 'h-12' },
        { weight: 2.5, color: 'bg-black', height: 'h-10' },
        { weight: 1.25, color: 'bg-gray-400', height: 'h-8' },
      ];

  useEffect(() => {
    if (isOpen) {
        setTargetWeight(initialWeight || '');
        // Reset base weight default when opening if needed, or keep last used
    }
  }, [isOpen, initialWeight]);

  useEffect(() => {
    calculate();
  }, [targetWeight, baseWeight]);

  const calculate = () => {
    const target = parseFloat(targetWeight);
    const base = parseFloat(baseWeight) || 0;

    // Safety check
    if (!target || target < base) {
      setPlates([]);
      setRemainder(0);
      return;
    }

    // Weight required per side
    let weightPerSide = (target - base) / 2;
    
    const result = [];

    plateConfig.forEach(p => {
      while (weightPerSide >= p.weight) {
        result.push(p);
        weightPerSide -= p.weight;
      }
    });

    setPlates(result);
    setRemainder(weightPerSide); 
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-700 w-full max-w-sm rounded-xl shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="text-white font-bold uppercase italic flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
            Plate Calculator
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white px-2">✕</button>
        </div>

        <div className="p-6">
          
          {/* 1. Target Weight Input */}
          <div className="mb-6">
            <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Target Weight ({unit})</label>
            <input 
              type="number" 
              value={targetWeight} 
              onChange={(e) => setTargetWeight(e.target.value)} 
              className="w-full bg-black border border-zinc-700 rounded p-3 text-white font-mono text-3xl font-black text-center focus:border-blue-500 outline-none"
              placeholder="0"
              autoFocus
            />
          </div>

          {/* 2. Base/Bar Weight Selection */}
          <div className="mb-8">
             <div className="flex justify-between items-end mb-2">
                <label className="text-[10px] text-zinc-500 font-bold uppercase">Bar / Base Weight</label>
                <input 
                    type="number"
                    value={baseWeight}
                    onChange={(e) => setBaseWeight(e.target.value)}
                    className="bg-black border border-zinc-700 rounded p-1 w-16 text-right text-white text-xs font-bold outline-none focus:border-blue-500"
                />
             </div>
             <div className="grid grid-cols-4 gap-2">
                {barOptions.map((opt) => (
                    <button
                        key={opt.label}
                        onClick={() => setBaseWeight(opt.weight)}
                        className={`py-2 rounded border text-[10px] font-bold uppercase transition ${
                            parseFloat(baseWeight) === opt.weight 
                            ? 'bg-zinc-700 text-white border-zinc-500' 
                            : 'bg-black text-zinc-500 border-zinc-800 hover:border-zinc-600'
                        }`}
                    >
                        {opt.label}
                        <span className="block text-[9px] opacity-70">{opt.weight}</span>
                    </button>
                ))}
             </div>
          </div>

          {/* 3. Visual Barbell */}
          <div className="flex items-center justify-center h-24 relative mb-4 border-t border-zinc-800 pt-6">
            {/* The Bar Shaft */}
            <div className="absolute w-full h-3 bg-zinc-600/50 rounded-full z-0"></div>
            
            {/* The Collar/Hub (Only show if base weight > 0) */}
            {parseFloat(baseWeight) > 0 && (
                <div className="absolute left-0 w-6 h-8 bg-zinc-500 rounded-sm z-10 border border-black/30"></div>
            )}

            {/* The Plates Stack */}
            <div className={`flex items-center gap-0.5 z-20 relative ${parseFloat(baseWeight) > 0 ? 'ml-8' : ''}`}>
                {plates.length === 0 && (
                    <span className="text-zinc-600 text-xs font-bold absolute -top-8 left-0 whitespace-nowrap">
                        {parseFloat(baseWeight) >= parseFloat(targetWeight) ? 'Just the bar' : 'Add weight'}
                    </span>
                )}
                {plates.map((p, i) => (
                    <div key={i} className={`w-3 md:w-4 ${p.height} ${p.color} rounded-[2px] border border-black/30 shadow-xl relative group`}>
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap border border-zinc-700 pointer-events-none z-50">
                            {p.weight}
                        </div>
                    </div>
                ))}
            </div>
          </div>

          {/* 4. Text Summary */}
          <div className="text-center">
            <p className="text-zinc-500 text-[10px] uppercase font-bold mb-2">Load Per Side</p>
            <div className="flex flex-wrap justify-center gap-2">
                {plates.length > 0 ? (
                    plates.map((p, i) => (
                        <span key={i} className="bg-zinc-800 border border-zinc-700 text-white text-xs font-bold px-2 py-1 rounded">
                            {p.weight}
                        </span>
                    ))
                ) : (
                    <span className="text-zinc-700 text-xs italic">---</span>
                )}
            </div>
            {remainder > 0 && (
                <p className="text-orange-500 text-[10px] mt-3 font-bold bg-orange-900/10 inline-block px-2 py-1 rounded border border-orange-900/30">
                    + {remainder.toFixed(2)} {unit} micro-load / clips
                </p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}