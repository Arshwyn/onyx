import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import AuthPage from './components/AuthPage';

// Components
import DailyView from './components/DailyView';
import HistoryView from './components/HistoryView';
import RoutineManager from './components/RoutineManager';
import TrendsView from './components/TrendsView';
import WorkoutLogger from './components/WorkoutLogger';

export default function App() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState('daily'); // daily, history, manage, trends, log

  useEffect(() => {
    // 1. Check active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // 2. Listen for login/logout events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // If not logged in, show the Auth Page
  if (!session) {
    return <AuthPage />;
  }

  // --- MAIN APP ---
  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-blue-500/30">
      
      {/* Top Bar / Sign Out (Visible only on Manage tab for cleanliness, or globally) */}
      {view === 'manage' && (
        <div className="max-w-md mx-auto p-4 flex justify-end">
          <button 
            onClick={handleLogout}
            className="text-xs text-red-400 hover:text-red-300 underline"
          >
            Sign Out
          </button>
        </div>
      )}

      {/* Content Area */}
      <div className="p-4 pb-24"> {/* Added padding-bottom for navbar */}
        {view === 'daily' && <DailyView />}
        {view === 'history' && <HistoryView />}
        {view === 'manage' && <RoutineManager />}
        {view === 'trends' && <TrendsView />}
        {view === 'log' && <WorkoutLogger />}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 safe-area-pb">
        <div className="max-w-md mx-auto flex justify-around p-3">
          <NavButton active={view === 'daily'} onClick={() => setView('daily')} icon="📅" label="Today" />
          <NavButton active={view === 'log'} onClick={() => setView('log')} icon="✍️" label="Log" />
          <NavButton active={view === 'history'} onClick={() => setView('history')} icon="clock" label="History" />
          <NavButton active={view === 'trends'} onClick={() => setView('trends')} icon="📈" label="Trends" />
          <NavButton active={view === 'manage'} onClick={() => setView('manage')} icon="⚙️" label="Manage" />
        </div>
      </nav>
    </div>
  );
}

// Helper for Nav Icons
function NavButton({ active, onClick, icon, label }) {
    // Custom SVG icons for cleaner look
    const icons = {
        clock: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
    };

    return (
      <button 
        onClick={onClick}
        className={`flex flex-col items-center gap-1 transition-colors ${
          active ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        <span className="text-xl h-6 flex items-center">{icons[icon] || icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
      </button>
    );
}