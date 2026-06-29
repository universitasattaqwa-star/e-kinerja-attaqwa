'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Briefcase, Edit2, Save, X, AlertCircle, Check, Trash2, Plus } from 'lucide-react';

interface Role {
  id: string;
  nama_jabatan: string;
  permissions?: string[];
  created_at?: string;
}

export const AVAILABLE_PERMISSIONS = [
  { id: 'upload_dokumen', label: 'Upload Dokumen' },
  { id: 'validasi_laporan', label: 'Validasi Laporan (Asesor)' },
  { id: 'kelola_master', label: 'Kelola Master Data' },
  { id: 'manajemen_user', label: 'Manajemen User' }
];

export default function ManajemenJabatanView() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form State (Add New)
  const [newNamaJabatan, setNewNamaJabatan] = useState('');
  const [newPermissions, setNewPermissions] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  // Editing State (Inline)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editNamaJabatan, setEditNamaJabatan] = useState('');
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .order('nama_jabatan');

      if (rolesError) throw rolesError;
      setRoles(data || []);
    } catch (err: any) {
      console.error('Error fetching roles:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNamaJabatan.trim()) return;
    
    setIsAdding(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Clean up any old labels into proper IDs before saving
      const cleanedPermissions = newPermissions.map(perm => {
        const match = AVAILABLE_PERMISSIONS.find(ap => ap.label === perm);
        return match ? match.id : perm;
      });
      const uniqueCleaned = Array.from(new Set(cleanedPermissions));

      const payload: any = { 
        nama_jabatan: newNamaJabatan.trim(),
        permissions: uniqueCleaned
      };

      const { error: insertError } = await supabase
        .from('roles')
        .insert([payload]);

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('Nama Hak Akses sudah ada. Silakan gunakan nama lain.');
        }
        throw insertError;
      }
      
      setSuccess('Hak Akses baru berhasil ditambahkan!');
      setNewNamaJabatan('');
      setNewPermissions([]);
      await fetchRoles();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError('Gagal menambahkan Hak Akses: ' + err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditClick = (role: Role) => {
    setEditingRoleId(role.id);
    setEditNamaJabatan(role.nama_jabatan);
    setEditPermissions(role.permissions || []);
  };

  const handleCancelEdit = () => {
    setEditingRoleId(null);
    setEditNamaJabatan('');
    setEditPermissions([]);
  };

  const handleSaveEdit = async (roleId: string) => {
    if (!editNamaJabatan.trim()) return;
    
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Clean up any old labels into proper IDs before saving
      const cleanedPermissions = editPermissions.map(perm => {
        const match = AVAILABLE_PERMISSIONS.find(ap => ap.label === perm);
        return match ? match.id : perm;
      });
      const uniqueCleaned = Array.from(new Set(cleanedPermissions));

      const payload: any = { 
        nama_jabatan: editNamaJabatan.trim(),
        permissions: uniqueCleaned
      };

      const { error: updateError } = await supabase
        .from('roles')
        .update(payload)
        .eq('id', roleId);

      if (updateError) {
        if (updateError.code === '23505') {
          throw new Error('Nama Hak Akses sudah digunakan.');
        }
        throw updateError;
      }
      
      setSuccess('Hak Akses berhasil diperbarui!');
      setEditingRoleId(null);
      await fetchRoles();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError('Gagal memperbarui Hak Akses: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (roleId: string, roleName: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus Hak Akses "${roleName}"?`)) {
      return;
    }

    setError(null);
    setSuccess(null);
    
    try {
      // 1. Cek apakah ada dokumen yang bergantung pada Hak Akses ini
      const { count, error: countError } = await supabase
        .from('document_masters')
        .select('id', { count: 'exact', head: true })
        .eq('role_id', roleId);
        
      if (countError) throw countError;
      
      if (count && count > 0) {
        throw new Error(`Gagal menghapus: Terdapat ${count} dokumen master yang terikat dengan Hak Akses ini. Hapus atau pindahkan dokumen-dokumen tersebut terlebih dahulu.`);
      }

      // 2. Jika aman, lanjutkan penghapusan
      const { error: deleteError } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId);

      if (deleteError) {
        // Handle Foreign Key Constraint violation
        if (deleteError.code === '23503' || deleteError.message.includes('foreign key constraint')) {
          throw new Error('Gagal menghapus: Hak Akses ini sedang digunakan oleh pengguna aktif atau membawahi hak akses lain. Silakan kosongkan dulu anggotanya.');
        }
        throw deleteError;
      }
      
      setSuccess(`Hak Akses "${roleName}" berhasil dihapus.`);
      await fetchRoles();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message); // Will display the friendly FK constraint error if caught
    }
  };

  if (loading && roles.length === 0) {
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
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Hak Akses Sistem</h3>
      </div>

      {/* Add Role Form */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden p-6 md:p-8">
        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Tambah Hak Akses Baru</h4>
        
        <form onSubmit={handleAddRole} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full space-y-2">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Nama Hak Akses</label>
            <input
              type="text"
              required
              value={newNamaJabatan}
              onChange={(e) => setNewNamaJabatan(e.target.value)}
              placeholder="Misal: Asesor Prodi"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>
          
          <div className="flex-1 w-full space-y-2">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Kemampuan Akses</label>
            <div className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm flex flex-wrap gap-4">
              {AVAILABLE_PERMISSIONS.map(p => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded-md transition-colors">
                  <input
                    type="checkbox"
                    value={p.id}
                    checked={newPermissions.includes(p.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewPermissions([...newPermissions, p.id]);
                      } else {
                        setNewPermissions(newPermissions.filter(perm => perm !== p.id));
                      }
                    }}
                    className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                  />
                  <span className="text-gray-700 dark:text-gray-300 font-medium">{p.label}</span>
                </label>
              ))}
            </div>
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

      {/* Role List Table */}
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
                  <th className="px-4 py-4 font-bold text-gray-700 dark:text-gray-300">Tingkat Hak Akses</th>
                  <th className="px-4 py-4 font-bold text-gray-700 dark:text-gray-300">Kemampuan / Akses Fitur</th>
                  <th className="px-4 py-4 font-bold text-gray-700 dark:text-gray-300 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {roles.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-500">Tidak ada data Hak Akses.</td>
                  </tr>
                ) : (
                  roles.map((role) => {
                    const isEditing = editingRoleId === role.id;
                    
                    return (
                      <tr key={role.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-4 font-medium text-gray-900 dark:text-white">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editNamaJabatan}
                              onChange={(e) => setEditNamaJabatan(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-primary outline-none"
                              disabled={isSaving}
                            />
                          ) : (
                            role.nama_jabatan
                          )}
                        </td>
                        <td className="px-4 py-4 text-gray-600 dark:text-gray-400">
                          {isEditing ? (
                            <div className="flex flex-col gap-1.5 min-w-[150px]">
                              {AVAILABLE_PERMISSIONS.map(p => (
                                <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-1 rounded-md transition-colors">
                                  <input 
                                    type="checkbox"
                                    value={p.id}
                                    checked={editPermissions.includes(p.id) || editPermissions.includes(p.label)} // Compatibility check for old bad data
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        // Overwrite the array by appending the NEW ID, and filter out any accidental old labels for this id
                                        const cleanPerms = editPermissions.filter(perm => perm !== p.id && perm !== p.label);
                                        setEditPermissions([...cleanPerms, p.id]);
                                      } else {
                                        setEditPermissions(editPermissions.filter(perm => perm !== p.id && perm !== p.label));
                                      }
                                    }}
                                    disabled={isSaving}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                  />
                                  <span className="text-gray-700 dark:text-gray-300">{p.label}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {(role.permissions || []).length > 0 ? (
                                role.permissions!.map(p => {
                                  const match = AVAILABLE_PERMISSIONS.find(ap => ap.id === p || ap.label === p);
                                  return (
                                    <span key={p} className="inline-block px-2.5 py-1 bg-secondary/20 text-secondary-dark font-bold rounded-lg text-xs tracking-wide">
                                      {match ? match.label : p}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-xs text-gray-500 italic">Belum ada izin khusus</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleSaveEdit(role.id)}
                                disabled={isSaving}
                                className="px-3 py-1.5 bg-green-500 text-white hover:bg-green-600 rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1"
                              >
                                <Save className="w-3.5 h-3.5" />
                                {isSaving ? 'Menyimpan...' : 'Simpan'}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={isSaving}
                                className="px-3 py-1.5 bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1"
                              >
                                <X className="w-3.5 h-3.5" />
                                Batal
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEditClick(role)}
                                className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                title="Edit Jabatan"
                              >
                                <Edit2 className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleDelete(role.id, role.nama_jabatan)}
                                className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Hapus Jabatan"
                              >
                                <Trash2 className="w-5 h-5" />
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
