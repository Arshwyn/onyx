import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function SettingsView({ onNavigate }) {
  const [weightUnit, setWeightUnit] = useState('lbs');
  const [measureUnit, setMeasureUnit] = useState('in');
  const [timerIncs, setTimerIncs] = useState([30, 60, 90]);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    // Load saved settings or defaults
    setWeightUnit(localStorage.getItem('onyx_unit_weight') || 'lbs');
    setMeasureUnit(localStorage.getItem('onyx_unit_measure') || 'in');
    
    const savedTimer = localStorage.getItem('onyx_timer_incs');
    if (savedTimer) setTimerIncs(JSON.parse(savedTimer));

    // Get User Email
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email);
    });
  }, []);

  const saveSetting = (key, value) => {
    localStorage.setItem(key, value);
    // Dispatch event so other components (like DailyView) update instantly
    window.dispatchEvent(new Event('storage'));
  };

  const handleWeightChange = (unit) => {
    setWeightUnit(unit);
    saveSetting('onyx_unit_weight', unit);
  };

  const handleMeasureChange = (unit) => {
    setMeasureUnit(unit);
    saveSetting('onyx_unit_measure', unit);
  };

  const handleTimerChange = (index, value) => {
    const newIncs = [...timerIncs];
    newIncs[index] = parseInt(value) || 0;
    setTimerIncs(newIncs);
    localStorage.setItem('onyx_timer_incs', JSON.stringify(newIncs));
    window.dispatchEvent(new Event('storage'));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="w-full max-w-md mx-auto text-white pb-20 overflow-x-hidden animate-fade-in">
      
      {/* Header */}
      <div className="mb-8 border-b border-zinc-800 pb-4">
        <h1 className="text-3xl font-black italic uppercase">Settings</h1>
        <p className="text-zinc-500 text-xs">{userEmail}</p>
      </div>

      {/* 1. Routine Manager Link */}
      <div className="mb-6">
        <label className="text-xs text-blue-400 font-bold uppercase mb-2 block">Programming</label>
        <button 
          onClick={() => onNavigate('routine_manager')}
          className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-lg flex justify-between items-center group hover:bg-zinc-800 transition"
        >
          <div className="flex items-center gap-3">
            <div className="bg-blue-900/20 text-blue-400 p-2 rounded-full">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            </div>
            <div className="text-left">
              <span className="block font-bold text-gray-200">Routine Schedule</span>
              <span className="text-xs text-zinc-500">Edit your weekly workout plan</span>
            </div>
          </div>
          <svg className="w-5 h-5 text-zinc-600 group-hover:text-white transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
        </button>
      </div>

      {/* 2. Unit Preferences */}
      <div className="mb-6">
        <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">Display Units</label>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            
            {/* Weight Row */}
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-300">Weight</span>
                <div className="flex bg-black p-1 rounded">
                    <button 
                        onClick={() => handleWeightChange('lbs')}
                        className={`px-3 py-1 rounded text-xs font-bold transition ${weightUnit === 'lbs' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >LBS</button>
                    <button 
                        onClick={() => handleWeightChange('kg')}
                        className={`px-3 py-1 rounded text-xs font-bold transition ${weightUnit === 'kg' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >KG</button>
                </div>
            </div>

            {/* Distance Row */}
            <div className="p-4 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-300">Measurements</span>
                <div className="flex bg-black p-1 rounded">
                    <button 
                        onClick={() => handleMeasureChange('in')}
                        className={`px-3 py-1 rounded text-xs font-bold transition ${measureUnit === 'in' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >IN</button>
                    <button 
                        onClick={() => handleMeasureChange('cm')}
                        className={`px-3 py-1 rounded text-xs font-bold transition ${measureUnit === 'cm' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >CM</button>
                </div>
            </div>
        </div>
      </div>

      {/* 3. Timer Configuration */}
      <div className="mb-8">
        <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">Timer Quick-Adds (Seconds)</label>
        <div className="grid grid-cols-3 gap-3">
            {timerIncs.map((val, idx) => (
                <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-col items-center">
                    <label className="text-[10px] text-zinc-500 font-bold mb-1">Button {idx + 1}</label>
                    <input 
                        type="number" 
                        value={val} 
                        onChange={(e) => handleTimerChange(idx, e.target.value)}
                        className="w-full bg-black text-white text-center font-bold p-2 rounded border border-zinc-700 focus:border-blue-500 outline-none"
                    />
                </div>
            ))}
        </div>
      </div>

      {/* 4. Logout */}
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