import React, { useState, useEffect, Suspense, lazy } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { getUserSettings, updateUserSettings, flushWriteQueue } from './dataManager';
import AuthPage from './components/AuthPage';

// Components
import DailyView from './components/DailyView';
import SettingsView from './components/SettingsView';
import RestTimer from './components/RestTimer';
import Toast from './components/Toast';
import { TodayTabIcon, LogTabIcon, HistoryTabIcon, TrendsTabIcon, SettingsTabIcon } from './components/icons';

// Lazy-loaded: not needed for first paint of the default "daily" view.
const HistoryView = lazy(() => import('./components/HistoryView'));
const TrendsView = lazy(() => import('./components/TrendsView'));
const WorkoutLogger = lazy(() => import('./components/WorkoutLogger'));

function ViewLoader() {
  return (
    <div className="flex flex-col items-center justify-center pt-32 animate-pulse">
      <div className="text-zinc-500 text-sm font-mono">Loading...</div>
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [session, setSession] = useState<Session | null>(null);

  const [showTimer, setShowTimer] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Explicit "Resuming" state to control the global loader
  const [isResuming, setIsResuming] = useState(false);
  const [refreshKey, setRefreshKey] = useState(() => Date.now());

  // NEW: Trigger to force SettingsView to reset to hub
  const [settingsResetTrigger, setSettingsResetTrigger] = useState(0);

  // 1. Online/offline detection — warns before a write is attempted rather
  // than only after it silently fails. Reconnecting also flushes any writes
  // that got queued (see dataManager.ts's performWrite) while offline; a
  // mount-time flush covers the case where the app was closed while offline
  // and reopened after connectivity was already back.
  useEffect(() => {
    const goOnline = () => { setIsOffline(false); flushWriteQueue(); };
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    if (navigator.onLine) flushWriteQueue();
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // 2. Settings Listener
  useEffect(() => {
    const checkTimerSetting = () => {
      const isHidden = localStorage.getItem('onyx_show_timer') === 'false';
      setShowTimer(!isHidden);
    };
    checkTimerSetting();
    window.addEventListener('storage', checkTimerSetting);
    return () => window.removeEventListener('storage', checkTimerSetting);
  }, []);

  const syncSettings = async () => {
    try {
      const dbSettings = await getUserSettings();
      if (dbSettings) {
        localStorage.setItem('onyx_unit_weight', dbSettings.weight_unit);
        localStorage.setItem('onyx_unit_measure', dbSettings.measure_unit);
        localStorage.setItem('onyx_unit_distance', dbSettings.distance_unit || 'mi');
        localStorage.setItem('onyx_timer_incs', JSON.stringify(dbSettings.timer_increments));

        const timerVisible = dbSettings.show_timer !== false;
        localStorage.setItem('onyx_show_timer', String(timerVisible));

        const confettiEnabled = dbSettings.show_confetti !== false;
        localStorage.setItem('onyx_show_confetti', String(confettiEnabled));

        const showBW = dbSettings.show_body_weight !== false;
        const showMeas = dbSettings.show_measurements !== false;
        localStorage.setItem('onyx_show_bw', String(showBW));
        localStorage.setItem('onyx_show_meas', String(showMeas));

        // Progression suggestions default OFF, unlike every toggle above.
        const progressionEnabled = dbSettings.progression_enabled === true;
        localStorage.setItem('onyx_progression_enabled', String(progressionEnabled));

        const defaultStep = dbSettings.weight_unit === 'kg' ? 2.5 : 5;
        localStorage.setItem('onyx_progression_step', String(dbSettings.progression_step ?? defaultStep));

        const defaultBar = dbSettings.weight_unit === 'kg' ? 20 : 45;
        localStorage.setItem('onyx_default_bar_weight', String(dbSettings.default_bar_weight ?? defaultBar));

        // Only mirror an actual override -- an unset column means "use the
        // built-in default," which getMechanicRepDefaults() already falls
        // back to when there's no localStorage key at all, so writing
        // nothing here (rather than the default itself) keeps that distinct
        // from a user having explicitly saved the same values.
        if (dbSettings.mechanic_rep_defaults) {
          localStorage.setItem('onyx_mechanic_rep_defaults', JSON.stringify(dbSettings.mechanic_rep_defaults));
        }

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
          show_measurements: true,
          progression_enabled: false,
          progression_step: 5,
          default_bar_weight: 45
        });
      }
    } catch (e) {
      console.warn("Background settings sync failed (connection might be recovering)", e);
    }
  };

  // 3. Auth & Connection Management
  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session) await syncSettings(); // Initial load can wait
    };
    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      // On auth change, we can sync settings safely
      if (session) syncSettings();
    });

    // --- RESUME / RE-SYNC LOGIC ---
    // Only run the full "stale session" recovery (channel cleanup, forced
    // session refresh, DailyView remount) when the app was actually
    // backgrounded long enough for sockets/session to plausibly have gone
    // stale — not on every brief app-switch or window-focus blip, which
    // this fired on unconditionally before. Below the threshold, skip
    // straight through: no remount, no "Resuming..." flash, and the user
    // keeps whatever they were doing (in-progress set inputs, expanded
    // cards, scroll position). 30 minutes: normal app-switching during a
    // session — checking a notification, glancing at another app, even
    // setting the phone down for a few minutes — shouldn't trigger a
    // reload at all.
    const RESUME_THRESHOLD_MS = 30 * 60 * 1000;
    let hiddenSince: number | null = null;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        hiddenSince = Date.now();
        return;
      }
      if (document.visibilityState !== 'visible') return;

      const backgroundedForMs = hiddenSince !== null ? Date.now() - hiddenSince : 0;
      hiddenSince = null;
      if (backgroundedForMs < RESUME_THRESHOLD_MS) return;

      console.log(`App resumed after ${Math.round(backgroundedForMs / 1000)}s backgrounded. Starting recovery...`);

      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (currentSession) {
        // A. ENTER RESUME MODE
        setIsResuming(true);

        // TIMEOUT HELPER
        const safeAwait = <T,>(promise: Promise<T>, ms = 2000): Promise<T | 'timeout'> => Promise.race([
          promise,
          new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), ms))
        ]);

        // B. CLEANUP & AGGRESSIVE HANDSHAKE
        await safeAwait(supabase.removeAllChannels());
        console.log("Channels cleared. Forcing network refresh...");
        await safeAwait(supabase.auth.refreshSession());

        // C. WAIT FOR SOCKET STABILITY
        console.log("Network refreshed. Waiting for socket...");
        await new Promise(r => setTimeout(r, 500));

        // D. RESTORE UI
        setSession(currentSession);
        setRefreshKey(Date.now()); // Forces fresh mount of DailyView

        console.log("Restoring UI now (syncing settings in background)...");
        syncSettings();

        const isHidden = localStorage.getItem('onyx_show_timer') === 'false';
        setShowTimer(!isHidden);

        setIsResuming(false);
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

  // NEW: Logic to handle clicking the Settings tab
  const handleSettingsClick = () => {
    if (location.pathname === '/settings') {
        // If already on settings, increment trigger to force reset to hub
        setSettingsResetTrigger(prev => prev + 1);
    } else {
        navigate('/settings');
    }
  };

  if (!session) return <AuthPage />;

  return (
    <div className="h-dvh overflow-hidden flex flex-col bg-black text-white font-sans selection:bg-blue-500/30">
      {/* Banner and Toast share one fixed-position stack, in normal document
          flow, so the banner pushes Toast down via ordinary layout instead
          of Toast needing a JS-measured offset to avoid being covered by it
          (which was prone to a race between the 'offline' event and the
          measurement effect). */}
      <div className="fixed top-0 left-0 right-0 z-[70] flex flex-col pointer-events-none">
        {isOffline && (
          <div className="pointer-events-auto bg-amber-900/95 backdrop-blur-md text-amber-200 text-center text-xs font-bold uppercase tracking-wider py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            You're offline — changes will sync once you're back online
          </div>
        )}
        <Toast stackedBelowBanner={isOffline} />
      </div>

      {/* This is the only element that scrolls — it's bounded by the shell's
          h-dvh instead of growing with content, so the page can never scroll
          just because of a transient render being taller than final content
          (e.g. a loading flicker). no-scrollbar hides the native scrollbar
          the same way the horizontal pill rows do, while overflow-y-auto
          still lets it scroll when content genuinely doesn't fit. */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 pb-24">

        {/* ROUTES: Only show loader for specific views that rely on fresh data */}

        <Routes>
          <Route path="/" element={<DailyView key={refreshKey} />} />

          <Route
            path="/history"
            element={<Suspense fallback={<ViewLoader />}><HistoryView /></Suspense>}
          />

          <Route
            path="/trends"
            element={<Suspense fallback={<ViewLoader />}><TrendsView /></Suspense>}
          />

          <Route
            path="/log"
            element={<Suspense fallback={<ViewLoader />}><WorkoutLogger /></Suspense>}
          />

          <Route
            path="/settings"
            element={<SettingsView resetTrigger={settingsResetTrigger} />}
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

      </div>

      {showTimer && !isResuming && <RestTimer />}

      <nav className="fixed bottom-0 left-0 right-0 flex items-center bg-[rgba(0,0,0,0.92)] backdrop-blur-md border-t border-border pt-2 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-50">
        <NavButton active={location.pathname === '/history'} onClick={() => navigate('/history')} icon="history" label="History" />
        <NavButton active={location.pathname === '/log'} onClick={() => navigate('/log')} icon="log" label="Log" />
        <NavButton active={location.pathname === '/'} onClick={() => navigate('/')} icon="today" label="Today" isToday />
        <NavButton active={location.pathname === '/trends'} onClick={() => navigate('/trends')} icon="trends" label="Trends" />
        <NavButton
          active={location.pathname === '/settings'}
          onClick={handleSettingsClick}
          icon="settings"
          label="Settings"
        />
      </nav>
    </div>
  );
}

// Simple internal component for the loading state
function ReconnectLoader() {
  return (
    <div className="flex flex-col items-center justify-center pt-32 animate-pulse">
      <div className="text-zinc-500 text-sm font-mono mb-2">Reconnecting...</div>
    </div>
  );
}

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: 'today' | 'log' | 'history' | 'trends' | 'settings';
  label: string;
  isToday?: boolean;
}

const TAB_ICONS: Record<NavButtonProps['icon'], React.ComponentType<{ color?: string; size?: number }>> = {
  today: TodayTabIcon,
  log: LogTabIcon,
  history: HistoryTabIcon,
  trends: TrendsTabIcon,
  settings: SettingsTabIcon,
};

function NavButton({ active, onClick, icon, label, isToday = false }: NavButtonProps) {
  const Icon = TAB_ICONS[icon];

  // Today is the app's home view, so it stays visually anchored as a raised
  // accent-filled circle at all times rather than reacting to `active` -- the
  // dot indicator below is what communicates "you're on this tab" for the
  // other four.
  if (isToday) {
    return (
      <button
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        aria-label={label}
        className="flex-1 flex items-center justify-center bg-none border-none cursor-pointer"
      >
        <span
          style={{ transform: 'translateY(-16px)' }}
          className="w-14 h-14 rounded-full bg-accent flex items-center justify-center shadow-[0_8px_22px_rgba(59,130,246,0.55)]"
        >
          <Icon color="#ffffff" size={24} />
        </span>
      </button>
    );
  }

  const color = active ? '#ffffff' : '#8e8e93';
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      className="flex-1 flex flex-col items-center justify-center gap-1.5 bg-none border-none py-2 cursor-pointer"
    >
      <Icon color={color} size={20} />
      <span style={{ opacity: active ? 1 : 0 }} className="w-1 h-1 rounded-full bg-accent" />
    </button>
  );
}