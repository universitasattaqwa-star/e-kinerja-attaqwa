'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Automatically append domain if user only enters NIY
      let loginEmail = email;
      if (!email.includes('@')) {
        // Pre-flight database lookup to find the real registered email for this NIY
        const { data: userData, error: lookupError } = await supabase
          .from('users')
          .select('email')
          .eq('niy', email)
          .maybeSingle();
          
        if (lookupError) {
          console.error("Lookup Error:", lookupError?.message || JSON.stringify(lookupError));
        }
          
        if (userData && userData.email) {
          // Use their actual registered email
          loginEmail = userData.email;
        } else {
          // Fallback to dummy domain if it's a completely new NIY-only user
          loginEmail = `${email}@citra.local`;
        }
      }

      console.log("Attempting login with:", loginEmail);

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error("Login Exception:", err);
      setError(err.message || "Terjadi kesalahan saat login");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-primary/5 z-0">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-primary-dark rounded-full opacity-10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-96 h-96 bg-secondary rounded-full opacity-20 blur-3xl"></div>
      </div>
      
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 z-10">
        <div className="bg-primary p-8 text-center relative overflow-hidden flex flex-col items-center">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-primary-dark rounded-full opacity-50 blur-xl"></div>
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-secondary rounded-full opacity-20 blur-xl"></div>
          
          <Image 
            src="/logo-kampus.png" 
            alt="Logo IAI At-Taqwa" 
            width={120} 
            height={120} 
            priority
            className="w-24 h-auto object-contain drop-shadow-md mb-4 relative z-10"
          />
          
          <h1 className="text-3xl font-bold text-white relative z-10 tracking-tight">Citra At-Taqwa</h1>
          <p className="text-sm font-medium text-white/90 mt-1 relative z-10 tracking-wide">(Catatan Integritas dan Transparansi Kinerja)</p>
          <h2 className="text-secondary font-bold mt-2 relative z-10 tracking-widest text-xs uppercase">Universitas At-Taqwa Bondowoso</h2>
        </div>
        
        <div className="p-8">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 text-center">
            Login Civitas Akademik
          </h2>
          
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm mb-6 border border-red-100 dark:border-red-800/50">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email atau NIK/NIY
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-colors"
                placeholder="Masukkan Email atau NIK/NIY"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-4 rounded-lg transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-primary/30 mt-6"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : 'Masuk'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
