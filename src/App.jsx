import React, { useState } from 'react';
import ExerciseManager from './components/ExerciseManager';
import RoutineManager from './components/RoutineManager';
import DailyView from './components/DailyView';
import WorkoutLogger from './components/WorkoutLogger';
import HistoryView from './components/HistoryView';
import TrendsView from './components/TrendsView';

function App() {
  // Default view is 'today'
  const [view, setView] = useState('today');
  
  // Sub-view for the Manage tab (now only Routines & Exercises)
  const [manageView, setManageView] = useState('routines'); 

  // Helper to style the active tab
  const getTabClass = (tabName) => {
    const isActive = view === tabName;
    // We use min-w-0 and whitespace-nowrap to handle the 5-button layout on small screens
    return `flex-1 py-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition border-b-2 min-w-0 whitespace-nowrap ${
      isActive 
        ? 'border-white text-white' 
        : 'border-transparent text-zinc-500 hover:text-zinc-300'
    }`;
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black">
      
      {/* Header */}
      <header className="p-6 border-b border-zinc-900 flex justify-center sticky top-0 bg-black/95 z-20 backdrop-blur">
        <h1 className="text-3xl font-black tracking-tighter uppercase italic">
          Onyx
        </h1>
      </header>

      {/* Main Navigation (5 Tabs) */}
      <div className="flex border-b border-zinc-800 mb-4 bg-zinc-900/30 sticky top-[85px] z-20 backdrop-blur overflow-x-auto no-scrollbar">
        <button onClick={() => setView('today')} className={getTabClass('today')}>
          Today
        </button>
        <button onClick={() => setView('logger')} className={getTabClass('logger')}>
          Log
        </button>
        <button onClick={() => setView('history')} className={getTabClass('history')}>
          History
        </button>
        <button onClick={() => setView('trends')} className={getTabClass('trends')}>
          Trends
        </button>
        <button onClick={() => setView('manage')} className={getTabClass('manage')}>
          Manage
        </button>
      </div>

      <main className="p-4 pb-20">
        
        {/* 1. Today's Routine View */}
        {view === 'today' && <DailyView />}

        {/* 2. Manual Logger (The "One-Off" Tab) */}
        {view === 'logger' && <WorkoutLogger />}
        
        {/* 3. History View */}
        {view === 'history' && <HistoryView />}
        
        {/* 4. Trends View */}
        {view === 'trends' && <TrendsView />}

        {/* 5. Management View (Routines & Exercises) */}
        {view === 'manage' && (
          <div>
            <div className="flex justify-center gap-4 mb-8">
              <button 
                onClick={() => setManageView('routines')}
                className={`px-4 py-1 rounded-full text-xs font-bold transition ${
                  manageView === 'routines' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Routines
              </button>
              <button 
                onClick={() => setManageView('exercises')}
                className={`px-4 py-1 rounded-full text-xs font-bold transition ${
                  manageView === 'exercises' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Exercises
              </button>
            </div>

            {manageView === 'routines' && <RoutineManager />}
            {manageView === 'exercises' && <ExerciseManager />}
          </div>
        )}

      </main>
    </div>
  );
}

export default App;