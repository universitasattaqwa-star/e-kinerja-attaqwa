'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface SubmissionFormProps {
  documentMasterId: string;
  userId: string;
  isMultiple: boolean;
  onSuccess: () => void;
  onCancel?: () => void;
  isLocked?: boolean;
  periodeAktif?: string; // Legacy / Fallback
  periodeAktifId?: string;
}

export default function SubmissionForm({ documentMasterId, userId, isMultiple, onSuccess, onCancel, isLocked = false, periodeAktif = '', periodeAktifId = '' }: SubmissionFormProps) {
  const [urlGdrive, setUrlGdrive] = useState('');
  const [judulKustom, setJudulKustom] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePeriodeName, setActivePeriodeName] = useState<string>('');
  const [activePeriodeId, setActivePeriodeId] = useState<string>('');

  useEffect(() => {
    const fetchActivePeriode = async () => {
      const { data, error } = await supabase
        .from('periode')
        .select('id, nama_periode')
        .eq('is_active', true)
        .limit(1)
        .single();
      
      if (data && !error) {
        setActivePeriodeName(data.nama_periode);
        setActivePeriodeId(data.id);
      }
    };
    fetchActivePeriode();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload: any = {
      user_id: userId,
      document_master_id: documentMasterId,
      url_gdrive: urlGdrive,
      semester: activePeriodeName || periodeAktif || 'Semester Aktif',
      periode_id: activePeriodeId || periodeAktifId || null,
    };

    if (isMultiple) {
      payload.judul_kustom = judulKustom;
    }

    const { error: insertError } = await supabase
      .from('submissions')
      .insert([payload]);

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setUrlGdrive('');
    setJudulKustom('');
    alert('Dokumen berhasil disubmit!');
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 p-5 border border-gray-100 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-800/80 shadow-sm text-left">
      {error && <div className="text-red-500 text-xs mb-3 font-medium bg-red-50 p-2 rounded">{error}</div>}
      <div className="space-y-4">
        {isMultiple && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Judul Dokumen (Misal: Sertifikat Lomba Nasional)
            </label>
            <input
              type="text"
              value={judulKustom}
              onChange={(e) => setJudulKustom(e.target.value)}
              required
              disabled={isLocked}
              className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-primary bg-gray-50 dark:bg-gray-900 text-sm transition-colors ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
              placeholder="Masukkan judul dokumen"
            />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Link Google Drive
          </label>
          <input
            type="url"
            value={urlGdrive}
            onChange={(e) => setUrlGdrive(e.target.value)}
            required
            disabled={isLocked}
            className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-primary bg-gray-50 dark:bg-gray-900 text-sm transition-colors ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
            placeholder="https://drive.google.com/..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Periode Laporan / Semester
          </label>
          <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm font-semibold cursor-not-allowed select-none">
            {activePeriodeName || periodeAktif || 'Memuat Periode...'}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              Batal
            </button>
          )}
          <button
            type="submit"
            disabled={loading || isLocked}
            className={`px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary-dark rounded-md transition-colors flex items-center gap-2 ${
              (loading || isLocked) ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Menyimpan...</>
            ) : isLocked ? (
              'Dikunci'
            ) : (
              'Submit Dokumen'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
