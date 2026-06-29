'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Edit2, Save, X, AlertCircle, Check, Key, Search, Plus, Trash2 } from 'lucide-react';

interface Role {
  id: string;
  nama_jabatan: string;
}

interface UserProfile {
  id: string;
  nama: string;
  niy: string;
  jabatan?: string;
  atasan_jabatan?: string;
  role_id: string; // Legacy
  role_ids: string[]; // New Multi-Role
}

export default function ManajemenUserView() {
  const displayRoleName = (name: string) => name === 'Tenaga Kependidikan' ? 'Pegawai' : name;

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [masterJabatans, setMasterJabatans] = useState<{nama_jabatan: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add User State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    nama: '',
    niy: '',
    jabatan: '',
    role_ids: [] as string[],
    atasan_jabatan: ''
  });
  
  // Editing state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [editingJabatan, setEditingJabatan] = useState<string>('');
  const [editingAtasanJabatan, setEditingAtasanJabatan] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('Semua');

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          user.niy.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Check if the user has a role that matches the filter
    const matchesRole = filterRole === 'Semua' || 
                        (user.role_ids && user.role_ids.some(rId => {
                          const roleObj = roles.find(r => String(r.id) === String(rId));
                          return roleObj?.nama_jabatan === filterRole;
                        }));
    return matchesSearch && matchesRole;
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select(`
          id,
          nama,
          niy,
          jabatan,
          atasan_jabatan,
          role_ids,
          role_id
        `)
        .order('nama');

      if (usersError) throw usersError;

      // Fetch roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('id, nama_jabatan')
        .order('nama_jabatan');

      if (rolesError) throw rolesError;

      // Fetch master jabatan
      const { data: masterJabatanData, error: masterJabatanError } = await supabase
        .from('master_jabatan')
        .select('nama_jabatan')
        .order('nama_jabatan');

      if (masterJabatanError) throw masterJabatanError;

      setUsers(usersData as unknown as UserProfile[]);
      setRoles(rolesData);
      setMasterJabatans(masterJabatanData);
    } catch (err: any) {
      console.error('Error fetching user data:', err);
      setError(err.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleEditClick = (user: UserProfile) => {
    setEditingUserId(user.id);
    setSelectedRoleIds(user.role_ids || (user.role_id ? [user.role_id] : []));
    setEditingJabatan(user.jabatan || '');
    setEditingAtasanJabatan(user.atasan_jabatan || '');
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setSelectedRoleIds([]);
    setEditingJabatan('');
    setEditingAtasanJabatan('');
  };

  const handleSaveUser = async (userId: string) => {
    if (selectedRoleIds.length === 0) {
      alert("Harap pilih minimal satu Hak Akses.");
      return;
    }
    if (!editingJabatan) return;
    
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch('/api/users/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          role_ids: selectedRoleIds,
          jabatan: editingJabatan || null,
          atasan_jabatan: editingAtasanJabatan || null
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal menyimpan perubahan');
      }
      
      setSuccess('Data pengguna berhasil diperbarui!');
      
      // Update local state to avoid full refetch if preferred, or just refetch silently
      await fetchData(false);
      setEditingUserId(null);
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError('Gagal memperbarui jabatan: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Yakin ingin menghapus user ini? Peringatan: Tindakan ini tidak dapat dibatalkan!")) {
      return;
    }
    
    setError(null);
    try {
      const response = await fetch(`/api/users/delete?id=${userId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Gagal menghapus user dari sistem');
      }

      setSuccess("User berhasil dihapus.");
      
      // Secara instan hapus dari state lokal UI
      setUsers(prev => prev.filter(u => u.id !== userId));
      
      // Tetap panggil fetch di background untuk konsistensi
      fetchData(false);
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error deleting user:", err);
      setError("Gagal menghapus user: " + err.message);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    setError(null);
    setSuccess(null);
    
    try {
      if (!newUser.role_ids || newUser.role_ids.length === 0) {
        throw new Error('Pilih setidaknya satu Hak Akses.');
      }

      let finalEmail = newUser.email.trim();
      if (!finalEmail) {
        finalEmail = `${newUser.niy.trim()}@citra.local`;
      }

      const payload = {
        ...newUser,
        email: finalEmail
      };

      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menambahkan pengguna');
      }

      setSuccess('Pengguna berhasil ditambahkan!');
      setIsAddModalOpen(false);
      setNewUser({
        email: '',
        password: '',
        nama: '',
        niy: '',
        jabatan: '',
        role_ids: [],
        atasan_jabatan: ''
      });
      await fetchData(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleResetPassword = async (userId: string, userName: string) => {
    const newPassword = window.prompt(`Masukkan password baru untuk pengguna ${userName}:\n(Minimal 6 karakter, biarkan kosong untuk batal)`);
    if (!newPassword) return;

    if (newPassword.length < 6) {
      alert('Password minimal 6 karakter.');
      return;
    }

    if (!window.confirm(`Anda yakin ingin mengubah password untuk ${userName}?`)) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newPassword }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal mengatur ulang password.');
      }

      setSuccess(`Password untuk ${userName} berhasil diubah!`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error('Reset password error:', err);
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="p-10 flex justify-center items-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 dark:bg-secondary/10 rounded-xl shadow-sm">
            <Users className="w-6 h-6 text-primary dark:text-secondary" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen User</h3>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold shadow-sm transition-colors w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          Tambah User
        </button>
      </div>

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

          {/* Search & Filter Bar */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Cari nama pegawai atau NIK/NIY..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
              />
            </div>
            <div className="w-full md:w-64 shrink-0">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all cursor-pointer appearance-none"
                style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%236b7280%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto' }}
              >
                <option value="Semua">Semua Jabatan</option>
                {roles.map(r => (
                  <option key={r.id} value={r.nama_jabatan}>{displayRoleName(r.nama_jabatan)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-y border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-4 font-bold text-gray-700 dark:text-gray-300">Nama Lengkap</th>
                  <th className="px-4 py-4 font-bold text-gray-700 dark:text-gray-300">NIY / NIK</th>
                  <th className="px-4 py-4 font-bold text-gray-700 dark:text-gray-300">Jabatan Struktural</th>
                  <th className="px-4 py-4 font-bold text-gray-700 dark:text-gray-300">Atasan Langsung</th>
                  <th className="px-4 py-4 font-bold text-gray-700 dark:text-gray-300">Hak Akses Sistem</th>
                  <th className="px-4 py-4 font-bold text-gray-700 dark:text-gray-300 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500 bg-gray-50 dark:bg-gray-800/20">Pencarian tidak ditemukan.</td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-4 font-medium text-gray-900 dark:text-white">{user.nama}</td>
                      <td className="px-4 py-4 text-gray-600 dark:text-gray-400">{user.niy}</td>
                      <td className="px-4 py-4">
                        {editingUserId === user.id ? (
                          <select
                            value={editingJabatan || ''}
                            onChange={(e) => setEditingJabatan(e.target.value)}
                            className="w-full max-w-[200px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-primary outline-none"
                            disabled={isSaving}
                          >
                            <option value="">-- Pilih Jabatan --</option>
                            {masterJabatans.map(j => (
                              <option key={j.nama_jabatan} value={j.nama_jabatan}>{j.nama_jabatan}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-gray-800 dark:text-gray-200 font-medium">
                            {user.jabatan || 'Belum Diatur'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {editingUserId === user.id ? (
                          <select
                            value={editingAtasanJabatan || ''}
                            onChange={(e) => setEditingAtasanJabatan(e.target.value)}
                            className="w-full max-w-[200px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-primary outline-none"
                            disabled={isSaving}
                          >
                            <option value="">-- Tidak Ada Atasan --</option>
                            {masterJabatans.map(a => (
                              <option key={a.nama_jabatan} value={a.nama_jabatan}>{a.nama_jabatan}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-gray-800 dark:text-gray-200 font-medium">
                            {user.atasan_jabatan || 'Tidak Ada'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {editingUserId === user.id ? (
                          <div className="flex flex-col gap-1.5 min-w-[150px]">
                            {roles.map(r => (
                              <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-1 rounded-md transition-colors">
                                <input 
                                  type="checkbox"
                                  value={r.id}
                                  checked={selectedRoleIds.includes(String(r.id))}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedRoleIds([...selectedRoleIds, String(r.id)]);
                                    } else {
                                      setSelectedRoleIds(selectedRoleIds.filter(id => id !== String(r.id)));
                                    }
                                  }}
                                  disabled={isSaving}
                                  className="rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <span className="text-gray-700 dark:text-gray-300">{displayRoleName(r.nama_jabatan)}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                              <div className="flex flex-wrap gap-1">
                                {user.role_ids && user.role_ids.length > 0 ? (
                                  user.role_ids.map(rId => {
                                    const rawRoleName = roles.find(r => String(r.id) === String(rId))?.nama_jabatan || '-';
                                    const roleName = displayRoleName(rawRoleName);
                                    const isSuperadmin = roleName.toLowerCase() === 'superadmin';
                                    return (
                                      <span key={rId} className={`inline-block px-2.5 py-1 font-bold rounded-lg text-xs tracking-wide shadow-sm
                                        ${isSuperadmin ? 'bg-primary/20 text-primary-dark border border-primary/20' : 'bg-secondary/20 text-secondary-dark border border-secondary/20'}`}>
                                        {roleName}
                                      </span>
                                    );
                                  })
                                ) : (
                                  <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-500 font-bold rounded-lg text-xs tracking-wide">
                                    {user.role_id ? displayRoleName(roles.find(r => String(r.id) === String(user.role_id))?.nama_jabatan || '-') : '-'}
                                  </span>
                                )}
                              </div>
                            )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {editingUserId === user.id ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleSaveUser(user.id)}
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
                              onClick={() => handleEditClick(user)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg text-xs font-bold transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleResetPassword(user.id, user.nama)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 rounded-lg text-xs font-bold transition-colors"
                              title="Atur Ulang Kata Sandi"
                            >
                              <Key className="w-3.5 h-3.5" />
                              Reset Password
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg text-xs font-bold transition-colors"
                              title="Hapus User"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Hapus
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Tambah Pengguna Baru
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors dark:hover:text-gray-300 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddUser} className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Email <span className="text-gray-400 font-normal text-xs">(Opsional)</span></label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={e => setNewUser({...newUser, email: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-gray-900 dark:text-white"
                    placeholder="email@institusi.ac.id"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Password <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-gray-900 dark:text-white"
                    placeholder="Minimal 6 karakter"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Nama Lengkap <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={newUser.nama}
                    onChange={e => setNewUser({...newUser, nama: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-gray-900 dark:text-white"
                    placeholder="Nama Lengkap beserta gelar"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">NIY / NIK <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={newUser.niy}
                    onChange={e => setNewUser({...newUser, niy: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-gray-900 dark:text-white"
                    placeholder="Nomor Induk Yayasan/Karyawan"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Jabatan Struktural <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={newUser.jabatan}
                    onChange={e => setNewUser({...newUser, jabatan: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-gray-900 dark:text-white cursor-pointer"
                  >
                    <option value="">-- Pilih Jabatan --</option>
                    {masterJabatans.map(j => (
                      <option key={j.nama_jabatan} value={j.nama_jabatan}>{j.nama_jabatan}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Hak Akses <span className="text-red-500">*</span></label>
                  <div className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl flex flex-wrap gap-4">
                    {roles.map(r => (
                      <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors">
                        <input 
                          type="checkbox"
                          value={r.id}
                          checked={newUser.role_ids.includes(String(r.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewUser({...newUser, role_ids: [...newUser.role_ids, String(r.id)]});
                            } else {
                              setNewUser({...newUser, role_ids: newUser.role_ids.filter(id => id !== String(r.id))});
                            }
                          }}
                          className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                        />
                        <span className="text-gray-700 dark:text-gray-300 font-medium">{r.nama_jabatan}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Atasan Langsung (Jabatan)</label>
                  <select
                    value={newUser.atasan_jabatan}
                    onChange={e => setNewUser({...newUser, atasan_jabatan: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-gray-900 dark:text-white cursor-pointer"
                  >
                    <option value="">-- Tidak Ada Atasan --</option>
                    {masterJabatans.map(a => (
                      <option key={a.nama_jabatan} value={a.nama_jabatan}>{a.nama_jabatan}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-gray-500">Pilih jabatan struktural (bukan nama orang) yang akan memvalidasi laporan ini.</p>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary-dark rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isAdding ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Simpan Pengguna
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
