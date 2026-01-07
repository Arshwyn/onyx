import React from 'react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, isDestructive = false }) {
  if (!isOpen) return null;

  return (
    // Backdrop
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      
      {/* Modal Box */}
      <div className="bg-zinc-900 border border-zinc-700 w-full max-w-xs rounded-xl shadow-2xl overflow-hidden transform transition-all scale-100">
        
        <div className="p-6 text-center">
          {/* Icon based on type */}
          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isDestructive ? 'bg-red-900/20 text-red-500' : 'bg-blue-900/20 text-blue-400'}`}>
            {isDestructive ? (
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            ) : (
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            )}
          </div>

          <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
          <p className="text-sm text-zinc-400">{message}</p>
        </div>

        {/* Buttons */}
        <div className="flex border-t border-zinc-800">
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
        </div>
      </div>
    </div>
  );
}