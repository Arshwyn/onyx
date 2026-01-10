import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  updateUserSettings, 
  getExercises, 
  addExercise, 
  deleteCustomExercise 
} from '../dataManager'; 
import ConfirmModal from './ConfirmModal';

export default function SettingsView({ onNavigate }) {
  const [viewMode, setViewMode] = useState('hub'); // hub, custom_exercises, display, units
  const [userEmail, setUserEmail] = useState('');

  // --- GLOBAL SETTINGS STATE ---
  const [weightUnit, setWeightUnit] = useState('lbs');
  const [measureUnit, setMeasureUnit] = useState('in');
  const [distUnit, setDistUnit] = useState('mi');
  // Default to 30, 60, 90 if nothing is saved
  const [timerIncs, setTimerIncs] = useState([30, 60, 90]);
  
  const [showTimer, setShowTimer] = useState(true);
  const [showConfetti, setShowConfetti] = useState(true);
  const [showBW, setShowBW] = useState(true);
  const [showMeas, setShowMeas] = useState(true);

  useEffect(() => {
    // Load local settings on mount
    setWeightUnit(localStorage.getItem('onyx_unit_weight') || 'lbs');
    setMeasureUnit(localStorage.getItem('onyx_unit_measure') || 'in');
    setDistUnit(localStorage.getItem('onyx_unit_distance') || 'mi');
    
    setShowTimer(localStorage.getItem('onyx_show_timer') !== 'false');
    setShowConfetti(localStorage.getItem('onyx_show_confetti') !== 'false');
    setShowBW(localStorage.getItem('onyx_show_bw') !== 'false');
    setShowMeas(localStorage.getItem('onyx_show_meas') !== 'false');

    const savedTimer = localStorage.getItem('onyx_timer_incs');
    if (savedTimer) {
      try {
        const parsed = JSON.parse(savedTimer);
        if (Array.isArray(parsed) && parsed.length === 3) {
          setTimerIncs(parsed);
        }
      } catch (e) {
        console.error("Error parsing timer settings", e);
      }
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email);
    });
  }, []);

  // --- HANDLERS ---
  const handleUpdateSetting = (key, value, storageKey, dbKey) => {
    localStorage.setItem(storageKey, value);
    window.dispatchEvent(new Event('storage')); // Notify other components
    updateUserSettings({ [dbKey]: value });
  };

  const handleUpdateTimerIncs = (newIncs) => {
    setTimerIncs(newIncs);
    localStorage.setItem('onyx_timer_incs', JSON.stringify(newIncs));
    window.dispatchEvent(new Event('storage'));
    updateUserSettings({ timer_increments: newIncs });
  };

  return (
    <div className="w-full max-w-md mx-auto text-white pb-20 overflow-x-hidden animate-fade-in">
      
      {/* Header */}
      <div className="mb-6 border-b border-zinc-800 pb-4">
        {viewMode === 'hub' ? (
          <>
            <h1 className="text-3xl font-black italic uppercase">Settings</h1>
            <p className="text-zinc-500 text-xs">{userEmail}</p>
          </>
        ) : (
          <button 
            onClick={() => setViewMode('hub')}
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition text-xs font-bold uppercase tracking-widest"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            Back to Settings
          </button>
        )}
      </div>

      {/* VIEW ROUTER */}
      {viewMode === 'hub' && (
        <SettingsHub 
          onNavigate={onNavigate} 
          onChangeView={setViewMode} 
        />
      )}

      {viewMode === 'custom_exercises' && (
        <CustomExercisesSettings />
      )}

      {viewMode === 'display' && (
        <DisplaySettings 
          showBW={showBW} setShowBW={(v) => { setShowBW(v); handleUpdateSetting('showBW', v, 'onyx_show_bw', 'show_body_weight'); }}
          showMeas={showMeas} setShowMeas={(v) => { setShowMeas(v); handleUpdateSetting('showMeas', v, 'onyx_show_meas', 'show_measurements'); }}
          showTimer={showTimer} setShowTimer={(v) => { setShowTimer(v); handleUpdateSetting('showTimer', v, 'onyx_show_timer', 'show_timer'); }}
          showConfetti={showConfetti} setShowConfetti={(v) => { setShowConfetti(v); handleUpdateSetting('showConfetti', v, 'onyx_show_confetti', 'show_confetti'); }}
          timerIncs={timerIncs}
          setTimerIncs={handleUpdateTimerIncs}
        />
      )}

      {viewMode === 'units' && (
        <UnitsPreferences 
          weightUnit={weightUnit} setWeightUnit={(v) => { setWeightUnit(v); handleUpdateSetting('weightUnit', v, 'onyx_unit_weight', 'weight_unit'); }}
          measureUnit={measureUnit} setMeasureUnit={(v) => { setMeasureUnit(v); handleUpdateSetting('measureUnit', v, 'onyx_unit_measure', 'measure_unit'); }}
          distUnit={distUnit} setDistUnit={(v) => { setDistUnit(v); handleUpdateSetting('distUnit', v, 'onyx_unit_distance', 'distance_unit'); }}
        />
      )}

    </div>
  );
}

// --- SUB-COMPONENTS ---

function SettingsHub({ onNavigate, onChangeView }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="space-y-3 animate-fade-in">
      
      {/* 1. Routine Schedule */}
      <HubButton 
        label="Routine Schedule" 
        subLabel="Edit your weekly workout plan"
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>}
        onClick={() => onNavigate('routine_manager')}
      />

      {/* 2. Custom Exercises */}
      <HubButton 
        label="Custom Exercises" 
        subLabel="Manage your exercise library"
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>}
        onClick={() => onChangeView('custom_exercises')}
      />

      {/* 3. Display Settings */}
      <HubButton 
        label="Display Settings" 
        subLabel="Timer and UI toggles"
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>}
        onClick={() => onChangeView('display')}
      />

      {/* 4. Units & Preferences */}
      <HubButton 
        label="Units & Preferences" 
        subLabel="Set measurement defaults"
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg>}
        onClick={() => onChangeView('units')}
      />

      {/* Sign Out */}
      <div className="pt-6 mt-6 border-t border-zinc-800">
        <button onClick={handleLogout} className="w-full py-4 rounded-lg border border-red-900/30 text-red-500 bg-red-900/10 font-bold uppercase tracking-widest text-xs hover:bg-red-900/20 transition">Sign Out</button>
        <div className="text-center mt-4"><span className="text-[10px] text-zinc-600">Onyx v1.3.1</span></div>
      </div>
    </div>
  );
}

function CustomExercisesSettings() {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState('Push');
  const [modalConfig, setModalConfig] = useState({ isOpen: false });

  const CATEGORIES = ['Push', 'Pull', 'Legs', 'Core', 'Other'];

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await getExercises();
    setExercises(data);
    setLoading(false);
  };

  const handleAdd = async () => {
    if(!newName) return;
    await addExercise(newName, newCat);
    setNewName('');
    loadData();
  };

  const handleDelete = (id) => {
    setModalConfig({
        isOpen: true,
        title: "Delete Exercise?",
        message: "Are you sure? This will remove it from your selection lists.",
        onConfirm: async () => {
            await deleteCustomExercise(id);
            loadData();
        },
        isDestructive: true
    });
  };

  // Helper to distinguish custom from default if default IDs are hardcoded 'ex_'
  const isCustom = (id) => !String(id).startsWith('ex_');

  return (
    <div className="animate-fade-in">
      <ConfirmModal {...modalConfig} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} />
      <h2 className="text-xl font-bold text-gray-300 mb-4">Custom Exercises</h2>
      
      {/* Add Form */}
      <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 mb-6">
        <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-2">Create New</label>
        <input 
            type="text" 
            value={newName} 
            onChange={e => setNewName(e.target.value)}
            className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-sm mb-3 outline-none focus:border-blue-500"
            placeholder="Exercise Name"
        />
        <div className="flex gap-2">
            <select value={newCat} onChange={e => setNewCat(e.target.value)} className="bg-black border border-zinc-700 rounded p-2 text-white text-sm outline-none">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={handleAdd} className="flex-1 bg-white text-black font-bold rounded text-xs uppercase hover:bg-gray-200">Add</button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? <div className="text-center text-zinc-500">Loading...</div> : (
            exercises.filter(ex => isCustom(ex.id)).length === 0 ? (
                <div className="text-center text-zinc-600 text-sm italic py-4">No custom exercises added yet.</div>
            ) : (
                exercises.filter(ex => isCustom(ex.id)).map(ex => (
                    <div key={ex.id} className="flex justify-between items-center bg-zinc-900/50 p-3 rounded border border-zinc-800">
                        <div>
                            <span className="text-sm font-bold text-gray-200 block">{ex.name}</span>
                            <span className="text-[10px] text-zinc-500 uppercase">{ex.category}</span>
                        </div>
                        <button onClick={() => handleDelete(ex.id)} className="text-zinc-600 hover:text-red-500 px-2">✕</button>
                    </div>
                ))
            )
        )}
      </div>
    </div>
  );
}

function DisplaySettings({ 
  showBW, setShowBW, 
  showMeas, setShowMeas, 
  showTimer, setShowTimer, 
  showConfetti, setShowConfetti,
  timerIncs, setTimerIncs 
}) {
  
  const handleTimerChange = (index, value) => {
    const val = parseInt(value);
    const newIncs = [...timerIncs];
    // Default to 0 if NaN, but keep input clean
    newIncs[index] = isNaN(val) ? 0 : val;
    setTimerIncs(newIncs);
  };

  return (
    <div className="animate-fade-in">
       <h2 className="text-xl font-bold text-gray-300 mb-4">Display Settings</h2>
       <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            
            {/* Show Timer Toggle */}
            <ToggleRow label="Show Rest Timer" checked={showTimer} onChange={setShowTimer} />
            
            {/* Timer Increments (Only visible if timer is ON) */}
            {showTimer && (
              <div className="bg-black/30 border-b border-zinc-800 p-4">
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-2">Timer Quick-Add Buttons (Seconds)</label>
                <div className="grid grid-cols-3 gap-3">
                  {timerIncs.map((val, idx) => (
                    <div key={idx} className="relative">
                       <input 
                          type="number" 
                          value={val || ''} 
                          onChange={(e) => handleTimerChange(idx, e.target.value)} 
                          className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white text-center font-bold outline-none text-sm focus:border-blue-500 transition" 
                          placeholder="0" 
                        />
                       <div className="absolute top-2 right-2 text-[8px] text-zinc-600 pointer-events-none">SEC</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ToggleRow label="Show Body Weight" checked={showBW} onChange={setShowBW} />
            <ToggleRow label="Show Measurements" checked={showMeas} onChange={setShowMeas} />
            <ToggleRow label="Celebrate PRs (Confetti)" checked={showConfetti} onChange={setShowConfetti} />
       </div>
    </div>
  );
}

function UnitsPreferences({ weightUnit, setWeightUnit, measureUnit, setMeasureUnit, distUnit, setDistUnit }) {
  return (
    <div className="animate-fade-in">
       <h2 className="text-xl font-bold text-gray-300 mb-4">Units & Preferences</h2>
       
       <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden mb-6">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-300">Weight Unit</span>
                <div className="flex bg-black p-1 rounded">
                    <button onClick={() => setWeightUnit('lbs')} className={`px-3 py-1 rounded text-xs font-bold transition ${weightUnit === 'lbs' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>LBS</button>
                    <button onClick={() => setWeightUnit('kg')} className={`px-3 py-1 rounded text-xs font-bold transition ${weightUnit === 'kg' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>KG</button>
                </div>
            </div>
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-300">Measurement Unit</span>
                <div className="flex bg-black p-1 rounded">
                    <button onClick={() => setMeasureUnit('in')} className={`px-3 py-1 rounded text-xs font-bold transition ${measureUnit === 'in' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>IN</button>
                    <button onClick={() => setMeasureUnit('cm')} className={`px-3 py-1 rounded text-xs font-bold transition ${measureUnit === 'cm' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>CM</button>
                </div>
            </div>
            <div className="p-4 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-300">Distance Unit</span>
                <div className="flex bg-black p-1 rounded">
                    <button onClick={() => setDistUnit('mi')} className={`px-3 py-1 rounded text-xs font-bold transition ${distUnit === 'mi' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>MI</button>
                    <button onClick={() => setDistUnit('km')} className={`px-3 py-1 rounded text-xs font-bold transition ${distUnit === 'km' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>KM</button>
                </div>
            </div>
       </div>
    </div>
  );
}

// --- HELPER UI ---

function HubButton({ label, subLabel, icon, onClick }) {
    return (
        <button 
          onClick={onClick}
          className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-lg flex justify-between items-center group hover:bg-zinc-800 transition"
        >
          <div className="flex items-center gap-4">
             <div className="text-zinc-500 group-hover:text-blue-400 transition">{icon}</div>
             <div className="text-left">
                <span className="block font-bold text-gray-200">{label}</span>
                <span className="text-xs text-zinc-500">{subLabel}</span>
             </div>
          </div>
          <svg className="w-5 h-5 text-zinc-600 group-hover:text-white transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
        </button>
    );
}

function ToggleRow({ label, checked, onChange }) {
    return (
        <div className="p-4 flex justify-between items-center border-b border-zinc-800 last:border-0">
            <span className="text-sm font-bold text-gray-300">{label}</span>
            <button onClick={() => onChange(!checked)} className={`w-12 h-6 rounded-full p-1 transition duration-300 ease-in-out ${checked ? 'bg-blue-600' : 'bg-zinc-700'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition duration-300 ease-in-out ${checked ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </button>
        </div>
    );
}