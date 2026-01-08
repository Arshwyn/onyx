import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { updateUserSettings } from '../dataManager'; 

export default function SettingsView({ onNavigate }) {
  const [weightUnit, setWeightUnit] = useState('lbs');
  const [measureUnit, setMeasureUnit] = useState('in');
  const [distUnit, setDistUnit] = useState('mi'); 
  const [timerIncs, setTimerIncs] = useState([30, 60, 90]);
  const [showTimer, setShowTimer] = useState(true); 
  const [showConfetti, setShowConfetti] = useState(true); 
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    setWeightUnit(localStorage.getItem('onyx_unit_weight') || 'lbs');
    setMeasureUnit(localStorage.getItem('onyx_unit_measure') || 'in');
    setDistUnit(localStorage.getItem('onyx_unit_distance') || 'mi'); 
    
    setShowTimer(localStorage.getItem('onyx_show_timer') !== 'false');
    setShowConfetti(localStorage.getItem('onyx_show_confetti') !== 'false');

    const savedTimer = localStorage.getItem('onyx_timer_incs');
    if (savedTimer) setTimerIncs(JSON.parse(savedTimer));

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email);
    });
  }, []);

  const handleWeightChange = (unit) => {
    setWeightUnit(unit);
    localStorage.setItem('onyx_unit_weight', unit);
    window.dispatchEvent(new Event('storage'));
    updateUserSettings({ weight_unit: unit });
  };

  const handleMeasureChange = (unit) => {
    setMeasureUnit(unit);
    localStorage.setItem('onyx_unit_measure', unit);
    window.dispatchEvent(new Event('storage'));
    updateUserSettings({ measure_unit: unit });
  };

  const handleDistChange = (unit) => {
    setDistUnit(unit);
    localStorage.setItem('onyx_unit_distance', unit);
    window.dispatchEvent(new Event('storage'));
    updateUserSettings({ distance_unit: unit });
  };

  const handleToggleTimer = (visible) => {
    setShowTimer(visible);
    localStorage.setItem('onyx_show_timer', visible);
    window.dispatchEvent(new Event('storage'));
    updateUserSettings({ show_timer: visible });
  };

  const handleToggleConfetti = (visible) => {
    setShowConfetti(visible);
    localStorage.setItem('onyx_show_confetti', visible);
    updateUserSettings({ show_confetti: visible });
  };

  const handleTimerChange = (index, value) => {
    const newIncs = [...timerIncs];
    // This handles the logic: empty string becomes 0 in state, 
    // but the input view logic below hides that 0.
    newIncs[index] = parseInt(value) || 0; 
    setTimerIncs(newIncs);
    localStorage.setItem('onyx_timer_incs', JSON.stringify(newIncs));
    window.dispatchEvent(new Event('storage'));
    updateUserSettings({ timer_increments: newIncs });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="w-full max-w-md mx-auto text-white pb-20 overflow-x-hidden animate-fade-in">
      
      <div className="mb-8 border-b border-zinc-800 pb-4">
        <h1 className="text-3xl font-black italic uppercase">Settings</h1>
        <p className="text-zinc-500 text-xs">{userEmail}</p>
      </div>

      {/* 1. Routines */}
      <div className="mb-6">
        <label className="text-xs text-blue-400 font-bold uppercase mb-2 block">Programming</label>
        <button 
          onClick={() => onNavigate('routine_manager')}
          className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-lg flex justify-between items-center group hover:bg-zinc-800 transition"
        >
          <div className="text-left">
            <span className="block font-bold text-gray-200">Routine Schedule</span>
            <span className="text-xs text-zinc-500">Edit your weekly workout plan</span>
          </div>
          <svg className="w-5 h-5 text-zinc-600 group-hover:text-white transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
        </button>
      </div>

      {/* 2. Interface */}
      <div className="mb-6">
        <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">Interface</label>
        
        {/* Rest Timer Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden mb-3">
            {/* Toggle Header */}
            <div className="p-4 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-300">Rest Timer</span>
                <button onClick={() => handleToggleTimer(!showTimer)} className={`w-12 h-6 rounded-full p-1 transition duration-300 ease-in-out ${showTimer ? 'bg-blue-600' : 'bg-zinc-700'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition duration-300 ease-in-out ${showTimer ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </button>
            </div>

            {/* Quick Adds Body (Only show if enabled) */}
            {showTimer && (
                <div className="px-4 pb-4 pt-0 animate-fade-in">
                    <div className="border-t border-zinc-800 pt-3 mb-2">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase block">Quick-Add Increments (Sec)</label>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {timerIncs.map((val, idx) => (
                            <div key={idx} className="bg-black border border-zinc-700 rounded p-2 flex flex-col items-center">
                                <label className="text-[9px] text-zinc-500 font-bold mb-1">Button {idx + 1}</label>
                                <input 
                                    type="number" 
                                    // FIXED: If value is 0, show empty string
                                    value={val === 0 ? '' : val} 
                                    onChange={(e) => handleTimerChange(idx, e.target.value)}
                                    className="w-full bg-transparent text-white text-center font-bold outline-none text-sm"
                                    placeholder="0"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Confetti Toggle */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex justify-between items-center">
            <span className="text-sm font-bold text-gray-300">Celebrate PRs</span>
            <button onClick={() => handleToggleConfetti(!showConfetti)} className={`w-12 h-6 rounded-full p-1 transition duration-300 ease-in-out ${showConfetti ? 'bg-blue-600' : 'bg-zinc-700'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition duration-300 ease-in-out ${showConfetti ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </button>
        </div>
      </div>

      {/* 3. Units */}
      <div className="mb-8">
        <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">Display Units</label>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-300">Weight</span>
                <div className="flex bg-black p-1 rounded">
                    <button onClick={() => handleWeightChange('lbs')} className={`px-3 py-1 rounded text-xs font-bold transition ${weightUnit === 'lbs' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>LBS</button>
                    <button onClick={() => handleWeightChange('kg')} className={`px-3 py-1 rounded text-xs font-bold transition ${weightUnit === 'kg' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>KG</button>
                </div>
            </div>
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-300">Measurements</span>
                <div className="flex bg-black p-1 rounded">
                    <button onClick={() => handleMeasureChange('in')} className={`px-3 py-1 rounded text-xs font-bold transition ${measureUnit === 'in' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>IN</button>
                    <button onClick={() => handleMeasureChange('cm')} className={`px-3 py-1 rounded text-xs font-bold transition ${measureUnit === 'cm' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>CM</button>
                </div>
            </div>
            <div className="p-4 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-300">Distance</span>
                <div className="flex bg-black p-1 rounded">
                    <button onClick={() => handleDistChange('mi')} className={`px-3 py-1 rounded text-xs font-bold transition ${distUnit === 'mi' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>MI</button>
                    <button onClick={() => handleDistChange('km')} className={`px-3 py-1 rounded text-xs font-bold transition ${distUnit === 'km' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>KM</button>
                </div>
            </div>
        </div>
      </div>

      {/* 4. Account */}
      <div className="border-t border-zinc-800 pt-6">
        <button 
          onClick={handleLogout}
          className="w-full py-4 rounded-lg border border-red-900/30 text-red-500 bg-red-900/10 font-bold uppercase tracking-widest text-xs hover:bg-red-900/20 transition"
        >
          Sign Out
        </button>
        <div className="text-center mt-4">
            <span className="text-[10px] text-zinc-600">Onyx v1.2.0</span>
        </div>
      </div>

    </div>
  );
}