import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { getUserSettings, updateUserSettings } from './dataManager'; 
import AuthPage from './components/AuthPage';

// Components
import DailyView from './components/DailyView';
import HistoryView from './components/HistoryView';
import RoutineManager from './components/RoutineManager';
import TrendsView from './components/TrendsView';
import WorkoutLogger from './components/WorkoutLogger';
import SettingsView from './components/SettingsView';
import RestTimer from './components/RestTimer';

export default function App() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState(() => localStorage.getItem('onyx_view') || 'daily');
  
  const [showTimer, setShowTimer] = useState(true);
  
  // Refresh Key state to force re-renders on resume
  const [refreshKey, setRefreshKey] = useState(Date.now());

  useEffect(() => {
    localStorage.setItem('onyx_view', view);
  }, [view]);

  useEffect(() => {
    const checkTimerSetting = () => {
      const isHidden = localStorage.getItem('onyx_show_timer') === 'false';
      setShowTimer(!isHidden);
    };
    checkTimerSetting();
    window.addEventListener('storage', checkTimerSetting);
    return () => window.removeEventListener('storage', checkTimerSetting);
  }, []);

  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session) await syncSettings();
    };
    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) await syncSettings();
    });

    // --- RESUME LISTENER (Global Fix) ---
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log("App resumed - Waking up connection...");
        
        // 1. Force Daily/History/Trends to remount and fetch fresh data
        setRefreshKey(Date.now());

        // 2. Wake up Auth Session (Fixes 'hanging' Logger requests)
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session); 
        
        if (session) await syncSettings();
        
        const isHidden = localStorage.getItem('onyx_show_timer') === 'false';
        setShowTimer(!isHidden);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
        subscription.unsubscribe();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  const syncSettings = async () => {
    const dbSettings = await getUserSettings();
    
    if (dbSettings) {
      localStorage.setItem('onyx_unit_weight', dbSettings.weight_unit);
      localStorage.setItem('onyx_unit_measure', dbSettings.measure_unit);
      localStorage.setItem('onyx_unit_distance', dbSettings.distance_unit || 'mi');
      localStorage.setItem('onyx_timer_incs', JSON.stringify(dbSettings.timer_increments));
      
      const timerVisible = dbSettings.show_timer !== false; 
      localStorage.setItem('onyx_show_timer', timerVisible);

      const confettiEnabled = dbSettings.show_confetti !== false; 
      localStorage.setItem('onyx_show_confetti', confettiEnabled);

      const showBW = dbSettings.show_body_weight !== false;
      const showMeas = dbSettings.show_measurements !== false;
      localStorage.setItem('onyx_show_bw', showBW);
      localStorage.setItem('onyx_show_meas', showMeas);
      
      window.dispatchEvent(new Event('storage'));
    } else {
      await updateUserSettings({
        weight_unit: 'lbs',
        measure_unit: 'in',
        distance_unit: 'mi',
        timer_increments: [30, 60, 90],
        show_timer: true,
        show_confetti: true,
        show_body_weight: true,
        show_measurements: true
      });
    }
  };

  if (!session) return <AuthPage />;

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-blue-500/30">
      <div className="p-4 pb-24">
        {/* KEY PROP: Forces remount on resume */}
        {view === 'daily' && <DailyView key={`daily-${refreshKey}`} />}
        {view === 'history' && <HistoryView key={`history-${refreshKey}`} />}
        {view === 'trends' && <TrendsView key={`trends-${refreshKey}`} />}
        
        {/* No key on Logger/Settings to preserve text input */}
        {view === 'log' && <WorkoutLogger />}
        {view === 'settings' && <SettingsView onNavigate={setView} />}
        {view === 'routine_manager' && <RoutineManager onBack={() => setView('settings')} />} 
      </div>
      
      {showTimer && <RestTimer />}

      <nav className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-md border-t border-zinc-900 safe-area-pb z-50">
        <div className="max-w-md mx-auto flex justify-between px-6 py-4">
          <NavButton active={view === 'daily'} onClick={() => setView('daily')} icon="calendar" label="Today" />
          <NavButton active={view === 'log'} onClick={() => setView('log')} icon="plus" label="Log" />
          <NavButton active={view === 'history'} onClick={() => setView('history')} icon="clock" label="History" />
          <NavButton active={view === 'trends'} onClick={() => setView('trends')} icon="chart" label="Trends" />
          <NavButton active={view === 'settings' || view === 'routine_manager'} onClick={() => setView('settings')} icon="settings" label="Settings" />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }) {
    const icons = {
        calendar: (<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>),
        plus: (<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>),
        clock: (<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>),
        chart: (<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>),
        settings: (<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>)
    };

    return (
      <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all duration-300 group ${active ? 'text-white scale-105' : 'text-zinc-600 hover:text-zinc-400'}`}>
        <span className="relative">
            {icons[icon] || icon}
            {active && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full animate-fade-in"></span>}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
      </button>
    );
}