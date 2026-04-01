import React from 'react';
import { LogIn, ChevronLeft } from 'lucide-react';
import { loginWithGoogle } from '../firebase';
import { motion } from 'motion/react';

export default function LoginPage() {
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
      window.location.href = '/user.html';
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized in Firebase. Please add "tanbhir-csv-pro.netlify.app" to your Firebase Authorized Domains.');
      } else {
        setError(err.message || 'An error occurred during login.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-[#1e293b] p-8 rounded-[2rem] border border-white/5 shadow-2xl text-center"
      >
        <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-blue-500/20">
          <LogIn className="w-10 h-10 text-blue-500" />
        </div>
        
        <h1 className="text-4xl font-black text-white mb-3 tracking-tight">Welcome Back</h1>
        <p className="text-white/40 mb-10 text-lg">Login to access your SEO Metadata Generator dashboard.</p>
        
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-medium">
            {error}
          </div>
        )}
        
        <button 
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-5 bg-white text-black font-black rounded-2xl flex items-center justify-center gap-4 transition-all hover:bg-white/90 shadow-2xl shadow-white/5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
          ) : (
            <>
              <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="Google" />
              <span className="text-lg">Continue with Google</span>
            </>
          )}
        </button>
        
        <div className="mt-12 pt-8 border-t border-white/5">
          <a 
            href="/user.html" 
            className="inline-flex items-center gap-2 text-sm font-bold text-white/30 hover:text-white transition-colors uppercase tracking-widest"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Home
          </a>
        </div>
      </motion.div>
      
      {/* Background Glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full -z-10 pointer-events-none" />
    </div>
  );
}
