'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings, Save, AlertCircle } from 'lucide-react';

export default function PengaturanSistemView() {
  const [batasWaktu, setBatasWaktu] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is multiple (or no) rows found
      setError('Gagal memuat pengaturan sistem: ' + error.message);
    } else if (data) {
      // Format timestamp for datetime-local input
      if (data.batas_waktu) {
        const date = new Date(data.batas_waktu);
        // Pad to ensure YYYY-MM-DDThh:mm
        const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
        const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
        setBatasWaktu(localISOTime);
      }
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ 
          batas_waktu: new Date(batasWaktu).toISOString() 
        })
        .eq('id', 1);

      if (error) throw error;
      setSuccess(true);
      alert('Pengaturan berhasil disimpan');
      fetchSettings();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError('Gagal menyimpan pengaturan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-10 flex justify-center items-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-primary/10 dark:bg-secondary/10 rounded-xl shadow-sm">
          <Settings className="w-6 h-6 text-primary dark:text-secondary" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Pengaturan Sistem</h3>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden max-w-2xl">
        <div className="p-6 md:p-8">
            Kelola tenggat waktu unggah untuk periode yang sedang aktif.

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl text-red-800 dark:text-red-400 text-sm shadow-sm flex gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl text-green-800 dark:text-green-400 text-sm shadow-sm flex gap-3">
              <Check className="w-5 h-5 flex-shrink-0" />
              <span>Pengaturan sistem berhasil disimpan!</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">


            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Batas Waktu Submit (Deadline)</label>
              <input
                type="datetime-local"
                required
                value={batasWaktu}
                onChange={(e) => setBatasWaktu(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-secondary focus:border-transparent transition-all"
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl transition-all shadow-md shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Menyimpan...</>
                ) : (
                  <><Save className="w-5 h-5" /> Simpan Pengaturan</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const Check = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);
