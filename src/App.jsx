import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import AuthPage from './components/AuthPage';

// Components
import DailyView from './components/DailyView';
import HistoryView from './components/HistoryView';
import RoutineManager from './components/RoutineManager';
import TrendsView from './components/TrendsView';
import WorkoutLogger from './components/WorkoutLogger';
import RestTimer from './components/RestTimer'; // <--- IMPORT THIS

export default function App() {
  const [session, setSession] = useState(null);
  
  const [view, setView] = useState(() => {
    return localStorage.getItem('onyx_view') || 'daily';
  });

  useEffect(() => {
    localStorage.setItem('onyx_view', view);
  }, [view]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

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

  if (!session) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-blue-500/30">
      
      {/* Sign Out (Visible on Manage tab) */}
      {view === 'manage' && (
        <div className="max-w-md mx-auto p-4 flex justify-end">
          <button 
            onClick={handleLogout}
            className="text-[10px] text-red-400 hover:text-red-300 border border-red-900/50 bg-red-900/10 px-3 py-1 rounded-full transition"
          >
            Sign Out
          </button>
        </div>
      )}

      {/* Content Area */}
      <div className="p-4 pb-24">
        {view === 'daily' && <DailyView />}
        {view === 'history' && <HistoryView />}
        {view === 'manage' && <RoutineManager />}
        {view === 'trends' && <TrendsView />}
        {view === 'log' && <WorkoutLogger />}
      </div>
      
      {/* Global Rest Timer Overlay */}
      <RestTimer />

      {/* Sleek Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-md border-t border-zinc-900 safe-area-pb z-50">
        <div className="max-w-md mx-auto flex justify-between px-6 py-4">
          <NavButton active={view === 'daily'} onClick={() => setView('daily')} icon="calendar" label="Today" />
          <NavButton active={view === 'log'} onClick={() => setView('log')} icon="plus" label="Log" />
          <NavButton active={view === 'history'} onClick={() => setView('history')} icon="clock" label="History" />
          <NavButton active={view === 'trends'} onClick={() => setView('trends')} icon="chart" label="Trends" />
          <NavButton active={view === 'manage'} onClick={() => setView('manage')} icon="settings" label="Manage" />
        </div>
      </nav>
    </div>
  );
}

// Helper for Nav Icons
function NavButton({ active, onClick, icon, label }) {
    const icons = {
        calendar: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        ),
        plus: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        clock: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        chart: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
        ),
        settings: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        )
    };

    return (
      <button 
        onClick={onClick}
        className={`flex flex-col items-center gap-1.5 transition-all duration-300 group ${
          active ? 'text-white scale-105' : 'text-zinc-600 hover:text-zinc-400'
        }`}
      >
        <span className="relative">
            {icons[icon] || icon}
            {active && (
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full animate-fade-in"></span>
            )}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
      </button>
    );
}