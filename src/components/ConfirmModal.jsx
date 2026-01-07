import React from 'react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, isDestructive = false }) {
  if (!isOpen) return null;

  // If no onConfirm function is passed, treat it as a simple "Alert" (OK button only)
  const isAlert = !onConfirm;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-700 w-full max-w-xs rounded-xl shadow-2xl overflow-hidden transform transition-all scale-100">
        
        <div className="p-6 text-center">
          {/* Icon */}
          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isDestructive ? 'bg-red-900/20 text-red-500' : 'bg-blue-900/20 text-blue-400'}`}>
            {isDestructive ? (
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            ) : (
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            )}
          </div>

          <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
          <p className="text-sm text-zinc-400">{message}</p>
        </div>

        {/* Buttons */}
        <div className="flex border-t border-zinc-800">
          {isAlert ? (
            // Alert Mode: Single OK Button
            <button 
                onClick={onClose}
                className="w-full py-3 text-sm font-bold text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
            >
                OK
            </button>
          ) : (
            // Confirm Mode: Cancel / Confirm Buttons
            <>
                <button 
                    onClick={onClose}
                    className="flex-1 py-3 text-sm font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
                >
                    Cancel
                </button>
                <div className="w-px bg-zinc-800"></div>
                <button 
                    onClick={() => { onConfirm(); onClose(); }}
                    className={`flex-1 py-3 text-sm font-bold transition ${
                        isDestructive 
                        ? 'text-red-500 hover:bg-red-900/20' 
                        : 'text-blue-400 hover:bg-blue-900/20'
                    }`}
                >
                    Confirm
                </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}