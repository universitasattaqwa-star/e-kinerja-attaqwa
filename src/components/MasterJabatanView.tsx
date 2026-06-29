'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Briefcase, Edit2, Save, X, AlertCircle, Check, Trash2, Plus } from 'lucide-react';

interface MasterJabatan {
  id: string;
  nama_jabatan: string;
  created_at?: string;
}

export default function MasterJabatanView() {
  const [jabatans, setJabatans] = useState<MasterJabatan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form State (Add New)
  const [newNamaJabatan, setNewNamaJabatan] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Editing State (Inline)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNamaJabatan, setEditNamaJabatan] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchJabatans();
  }, []);

  const fetchJabatans = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('master_jabatan')
        .select('*')
        .order('nama_jabatan');

      if (fetchError) throw fetchError;
      setJabatans(data || []);
    } catch (err: any) {
      console.error('Error fetching master jabatan:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNamaJabatan.trim()) return;
    
    setIsAdding(true);
    setError(null);
    setSuccess(null);
    
    try {
      const { error: insertError } = await supabase
        .from('master_jabatan')
        .insert([{ nama_jabatan: newNamaJabatan.trim() }]);

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('Nama Jabatan sudah ada. Silakan gunakan nama lain.');
        }
        throw insertError;
      }
      
      setSuccess('Jabatan baru berhasil ditambahkan!');
      setNewNamaJabatan('');
      await fetchJabatans();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError('Gagal menambahkan jabatan: ' + err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditClick = (jabatan: MasterJabatan) => {
    setEditingId(jabatan.id);
    setEditNamaJabatan(jabatan.nama_jabatan);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditNamaJabatan('');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editNamaJabatan.trim()) return;
    
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const { error: updateError } = await supabase
        .from('master_jabatan')
        .update({ nama_jabatan: editNamaJabatan.trim() })
        .eq('id', id);

      if (updateError) {
        if (updateError.code === '23505') {
          throw new Error('Nama Jabatan sudah digunakan.');
        }
        throw updateError;
      }
      
      setSuccess('Jabatan berhasil diperbarui!');
      setEditingId(null);
      await fetchJabatans();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError('Gagal memperbarui jabatan: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus jabatan "${name}"?`)) {
      return;
    }

    setError(null);
    setSuccess(null);
    
    try {
      const { error: deleteError } = await supabase
        .from('master_jabatan')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      
      setSuccess(`Jabatan "${name}" berhasil dihapus.`);
      await fetchJabatans();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError('Gagal menghapus jabatan: ' + err.message);
    }
  };

  if (loading && jabatans.length === 0) {
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
          <Briefcase className="w-6 h-6 text-primary dark:text-secondary" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Master Jabatan</h3>
      </div>

      {/* Add Form */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden p-6 md:p-8">
        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Tambah Jabatan Baru</h4>
        
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full space-y-2">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Nama Jabatan</label>
            <input
              type="text"
              required
              value={newNamaJabatan}
              onChange={(e) => setNewNamaJabatan(e.target.value)}
              placeholder="Misal: Biro TI, Dekan, dll"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>
          
          <button
            type="submit"
            disabled={isAdding}
            className="w-full md:w-auto px-6 py-2.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl transition-all shadow-md shadow-primary/20 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isAdding ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <><Plus className="w-5 h-5" /> Tambah</>
            )}
          </button>
        </form>
      </div>

      {/* List Table */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8">
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl text-red-800 dark:text-red-400 text-sm shadow-sm flex gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl text-green-800 dark:text-green-400 text-sm shadow-sm flex gap-3">
              <Check className="w-5 h-5 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-y border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-4 font-bold text-gray-700 dark:text-gray-300 w-16 text-center">No</th>
                  <th className="px-4 py-4 font-bold text-gray-700 dark:text-gray-300">Nama Jabatan</th>
                  <th className="px-4 py-4 font-bold text-gray-700 dark:text-gray-300 text-center w-32">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {jabatans.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-500">Belum ada data jabatan.</td>
                  </tr>
                ) : (
                  jabatans.map((jabatan, index) => {
                    const isEditing = editingId === jabatan.id;
                    
                    return (
                      <tr key={jabatan.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-4 font-medium text-gray-900 dark:text-white text-center">
                          {index + 1}
                        </td>
                        <td className="px-4 py-4 font-medium text-gray-900 dark:text-white">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editNamaJabatan}
                              onChange={(e) => setEditNamaJabatan(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-primary outline-none"
                              disabled={isSaving}
                            />
                          ) : (
                            jabatan.nama_jabatan
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleSaveEdit(jabatan.id)}
                                disabled={isSaving}
                                className="p-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                title="Simpan"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={isSaving}
                                className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                                title="Batal"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEditClick(jabatan)}
                                className="p-2 text-blue-500 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(jabatan.id, jabatan.nama_jabatan)}
                                className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Hapus"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
        </div>
      </div>
    </div>
  );
}
