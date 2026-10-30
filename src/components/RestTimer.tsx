import React, { useState, useEffect } from 'react';

export default function RestTimer() {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [increments, setIncrements] = useState([30, 60, 90]);


  // Load settings on mount and listen for changes
  useEffect(() => {
    const loadSettings = () => {
        const saved = localStorage.getItem('onyx_timer_incs');
        if (saved) setIncrements(JSON.parse(saved));
    };
    loadSettings();
    window.addEventListener('storage', loadSettings);
    return () => window.removeEventListener('storage', loadSettings);
  }, []);

  const playBeep = () => {
    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880; 
    gain.gain.value = 0.1;
    osc.start();
    setTimeout(() => osc.stop(), 500);
  };

  // Timer Logic. The effect re-runs every second (seconds is a dependency), so
  // the tick closure always sees the current value; finishing is handled in the
  // tick itself rather than by a follow-up effect that sets state.
  useEffect(() => {
    if (!isActive || seconds <= 0) return;
    const id = setInterval(() => {
      if (seconds <= 1) {
        setSeconds(0);
        setIsActive(false);
        playBeep();
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      } else {
        setSeconds(seconds - 1);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isActive, seconds]);

  const addTime = (secs: number) => {
    setSeconds(prev => prev + secs);
    if (!isActive) setIsActive(true);
    setIsExpanded(true);
  };

  const toggleTimer = () => { if (seconds > 0) setIsActive(!isActive); };
  const resetTimer = () => { setIsActive(false); setSeconds(0); setIsExpanded(false); };
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (seconds === 0 && !isExpanded) {
    return (
      <div className="fixed right-3.5 bottom-[104px] z-40 animate-fade-in">
        <button
          onClick={() => setIsExpanded(true)}
          className="w-12 h-12 rounded-pill bg-[#1a1a1e] border border-border-pill text-accent-light flex items-center justify-center cursor-pointer shadow-fab"
        >
          {/* stroke="currentColor" inherits the button's text-accent-light class below,
              rather than duplicating that token's hex value here. */}
          <svg width="22" height="22" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth={2} />
            <line x1="12" y1="12" x2="12" y2="8" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            <line x1="12" y1="12" x2="15" y2="14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed left-3.5 right-3.5 bottom-[104px] z-40 animate-fade-in">
      <div className="bg-[rgba(17,17,20,0.96)] border border-[rgba(59,130,246,0.25)] rounded-2xl shadow-timer p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-[7px]">
            <span className="text-[10px] text-accent-light font-extrabold uppercase tracking-[0.06em]">Rest Timer</span>
            {isActive && <span className="w-[7px] h-[7px] rounded-pill bg-success animate-pulse"></span>}
          </div>
          <button onClick={resetTimer} className="bg-none border-none text-text-faint text-sm cursor-pointer">&#10005;</button>
        </div>

        <div className="text-center mb-3.5">
            <div onClick={toggleTimer} className="font-mono text-[34px] font-bold text-white cursor-pointer select-none">
                {formatTime(seconds)}
            </div>
            <div className="text-[9px] text-text-faint uppercase font-bold tracking-[0.06em] mt-0.5">
                {isActive ? 'Tap to Pause' : 'Tap to Resume'}
            </div>
        </div>

        <div className="flex justify-center gap-2">
            {increments.map((inc, idx) => (
                <button
                    key={idx}
                    onClick={() => addTime(inc)}
                    className="bg-[#141416] border border-border-input text-white font-bold py-2 px-3.5 rounded-lg text-[11px] cursor-pointer"
                >
                    +{inc >= 60 ? `${Math.floor(inc/60)}:${(inc%60).toString().padStart(2,'0')}` : `${inc}s`}
                </button>
            ))}
        </div>
      </div>
    </div>
  );
}