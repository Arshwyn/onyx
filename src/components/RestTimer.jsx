import React, { useState, useEffect, useRef } from 'react';

export default function RestTimer() {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const intervalRef = useRef(null);

  // cleanup on unmount
  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (isActive && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => prev - 1);
      }, 1000);
    } else if (seconds === 0 && isActive) {
      // Timer finished
      playBeep();
      setIsActive(false);
      clearInterval(intervalRef.current);
      // Optional: Vibrate phone if supported
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isActive, seconds]);

  const playBeep = () => {
    // Simple oscillator beep using Web Audio API (no external file needed)
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.value = 880; // A5 note
    gain.gain.value = 0.1;

    osc.start();
    setTimeout(() => osc.stop(), 500);
  };

  const addTime = (secs) => {
    setSeconds(prev => prev + secs);
    if (!isActive) setIsActive(true);
    setIsExpanded(true);
  };

  const toggleTimer = () => {
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setSeconds(0);
    setIsExpanded(false);
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Render minimized view (floating button) if timer is 0 and not expanded
  if (seconds === 0 && !isExpanded) {
    return (
      <div className="fixed bottom-24 right-4 z-40 animate-fade-in">
        <button 
          onClick={() => setIsExpanded(true)}
          className="bg-zinc-800 border border-zinc-700 text-blue-400 w-12 h-12 rounded-full shadow-xl flex items-center justify-center font-bold hover:scale-105 transition hover:bg-zinc-700"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-24 left-4 right-4 z-40 animate-fade-in">
      <div className="bg-zinc-900/95 backdrop-blur-md border border-blue-900/30 rounded-2xl shadow-2xl p-4 mx-auto max-w-md">
        
        {/* Header / Time Display */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-400 font-bold uppercase tracking-wider">Rest Timer</span>
            {isActive && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
          </div>
          <button onClick={resetTimer} className="text-zinc-500 hover:text-white px-2">✕</button>
        </div>

        <div className="text-center mb-6">
            <div 
              onClick={toggleTimer}
              className={`text-5xl font-mono font-black cursor-pointer select-none transition ${isActive ? 'text-white' : 'text-zinc-500'}`}
            >
                {formatTime(seconds)}
            </div>
            <span className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest mt-1 block">
                {isActive ? 'Tap to Pause' : 'Tap to Resume'}
            </span>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-3">
            <button onClick={() => addTime(30)} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-4 rounded-lg text-xs border border-zinc-700 active:scale-95 transition">+30s</button>
            <button onClick={() => addTime(60)} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-4 rounded-lg text-xs border border-zinc-700 active:scale-95 transition">+1m</button>
            <button onClick={() => addTime(90)} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-4 rounded-lg text-xs border border-zinc-700 active:scale-95 transition">+1:30</button>
        </div>

      </div>
    </div>
  );
}