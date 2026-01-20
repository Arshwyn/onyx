import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [useMagicLink, setUseMagicLink] = useState(false); // Toggle for Magic Link mode
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    let result;

    if (useMagicLink) {
        // 1. Magic Link Login (for legacy users or password recovery)
        result = await supabase.auth.signInWithOtp({ 
            email,
            options: { emailRedirectTo: window.location.origin }
        });
    } else if (isSignUp) {
        // 2. Sign Up with Password
        result = await supabase.auth.signUp({ email, password });
    } else {
        // 3. Sign In with Password
        result = await supabase.auth.signInWithPassword({ email, password });
    }

    const { error, data } = result;

    if (error) {
      setMessage(error.message);
    } else {
      if (useMagicLink) {
        setMessage('Check your email for the login link!');
      } else if (isSignUp && !data.session) {
        setMessage('Success! Please check your email to confirm your account.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-white">
      <h1 className="text-4xl font-black italic uppercase mb-8">Onyx</h1>
      
      <div className="w-full max-w-sm bg-zinc-900 p-6 rounded-xl border border-zinc-800">
        <h2 className="text-xl font-bold mb-4">
          {useMagicLink ? 'Magic Link Login' : (isSignUp ? 'Create Account' : 'Welcome Back')}
        </h2>
        
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <input 
              type="email" 
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-zinc-700 rounded p-3 text-white outline-none focus:border-blue-500 transition"
              required
            />
          </div>
          
          {/* Hide password field if using Magic Link */}
          {!useMagicLink && (
            <div>
                <input 
                type="password" 
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-zinc-700 rounded p-3 text-white outline-none focus:border-blue-500 transition"
                required
                minLength={6}
                />
            </div>
          )}

          <button 
            disabled={loading}
            className="w-full bg-white text-black font-bold py-3 rounded hover:bg-gray-200 transition uppercase tracking-widest text-xs"
          >
            {loading ? 'Processing...' : (useMagicLink ? 'Send Magic Link' : (isSignUp ? 'Sign Up' : 'Sign In'))}
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-3 text-center">
            {/* Toggle Sign In / Sign Up */}
            {!useMagicLink && (
                <button 
                    onClick={() => { setIsSignUp(!isSignUp); setMessage(''); }}
                    className="text-xs text-zinc-500 hover:text-white underline"
                >
                    {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
                </button>
            )}

            {/* Toggle Magic Link */}
            <button 
                onClick={() => { setUseMagicLink(!useMagicLink); setMessage(''); }}
                className="text-xs text-blue-400 hover:text-blue-300"
            >
                {useMagicLink ? 'Back to Password Login' : 'Forgot Password / Login with Magic Link'}
            </button>
        </div>

        {message && (
          <div className={`mt-4 p-3 text-xs rounded border text-center ${message.includes('Success') || message.includes('Check') ? 'bg-green-900/20 text-green-400 border-green-900/50' : 'bg-red-900/20 text-red-400 border-red-900/50'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}