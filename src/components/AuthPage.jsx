import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function AuthPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Using "Magic Link" login (Email only, no password to remember)
    const { error } = await supabase.auth.signInWithOtp({ email });

    if (error) {
      setMessage('Error: ' + error.message);
    } else {
      setMessage('Check your email for the login link!');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-white">
      <h1 className="text-4xl font-black italic uppercase mb-8">Onyx</h1>
      
      <div className="w-full max-w-sm bg-zinc-900 p-6 rounded-xl border border-zinc-800">
        <h2 className="text-xl font-bold mb-4">Sign In / Sign Up</h2>
        <p className="text-sm text-zinc-400 mb-6">Enter your email to receive a magic login link.</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="email" 
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-black border border-zinc-700 rounded p-3 text-white outline-none focus:border-blue-500 transition"
            required
          />
          <button 
            disabled={loading}
            className="w-full bg-white text-black font-bold py-3 rounded hover:bg-gray-200 transition uppercase tracking-widest text-xs"
          >
            {loading ? 'Sending...' : 'Send Magic Link'}
          </button>
        </form>

        {message && (
          <div className="mt-4 p-3 bg-blue-900/20 text-blue-400 text-sm rounded border border-blue-900/50 text-center">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}