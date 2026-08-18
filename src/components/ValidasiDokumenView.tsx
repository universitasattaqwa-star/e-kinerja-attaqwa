'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Check, X, ExternalLink, RefreshCw, AlertCircle, ArrowLeft, Users, FileText, Badge, ClipboardList, Layers, Activity, Trophy, Search, Filter } from 'lucide-react';

interface SubmissionWithDetails {
  id: string;
  url_gdrive: string;
  status_validasi: string;
  catatan: string | null;
  semester: string;
  judul_kustom: string | null;
  created_at: string;
  user_id: string;
  users?: {
    id: string;
    nama: string;
    role_id: string;
    role_ids: string[];
    jabatan?: string;
    atasan_jabatan?: string;
  };
  document_masters?: {
    nama_dokumen: string;
    kategori: string;
    is_multiple: boolean;
  };
}

interface UserSummary {
  userId: string;
  nama: string;
  jabatan: string;
  totalSubmissions: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  submissions: SubmissionWithDetails[];
}

interface ValidasiDokumenViewProps {
  isSuperadminView: boolean;
  currentUserId?: string;
  currentUserJabatan?: string;
  selectedPeriodeId?: string;
  isActivePeriode?: boolean;
}

const CATEGORIES = [
  { name: 'SK & Kepegawaian', icon: Badge },
  { name: 'Tupoksi', icon: ClipboardList },
  { name: 'Tugas Tambahan', icon: Layers },
  { name: 'Penunjang', icon: Activity },
  { name: 'Prestasi', icon: Trophy }
];

export default function ValidasiDokumenView({ isSuperadminView, currentUserId, currentUserJabatan, selectedPeriodeId, isActivePeriode = true }: ValidasiDokumenViewProps) {
  const [submissions, setSubmissions] = useState<SubmissionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Detail View State
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailSubmissions, setDetailSubmissions] = useState<SubmissionWithDetails[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTotalItems, setDetailTotalItems] = useState(0);

  // Search & Filter States
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [docFilterStatus, setDocFilterStatus] = useState('Semua');

  // Pagination & Bulk Action States
  const itemsPerPage = 10;
  const [masterCurrentPage, setMasterCurrentPage] = useState(1);
  const [detailCurrentPage, setDetailCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // 1. Fetch ALL submissions for Master View Summary (Client-side grouping)
  const fetchMasterSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('submissions')
        .select(`
          *,
          catatan,
          users!inner (
            id, nama, role_ids, role_id, jabatan, atasan_jabatan
          ),
          document_masters (
            nama_dokumen, kategori, is_multiple
          )
        `)
        .order('created_at', { ascending: false });

      if (selectedPeriodeId) {
        query = query.eq('periode_id', selectedPeriodeId);
      }

      if (!isSuperadminView) {
        if (currentUserJabatan) {
          query = query.eq('users.atasan_jabatan', currentUserJabatan);
        } else {
          // Fallback: If Asesor has no Jabatan set, they shouldn't see anyone's submissions
          query = query.eq('users.atasan_jabatan', '___UNMATCHABLE_STATE___');
        }
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      
      setSubmissions((data as unknown as SubmissionWithDetails[]) || []);
    } catch (err: any) {
      console.error('Error fetching master submissions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isSuperadminView, currentUserJabatan]);

  // 2. Fetch PAGINATED submissions for Detail View (Server-side)
  const fetchDetailSubmissions = useCallback(async (userId: string, page: number, search: string, status: string) => {
    setDetailLoading(true);
    try {
      let query = supabase
        .from('submissions')
        .select(`
          *,
          catatan,
          users!inner (id, nama, role_ids, role_id, jabatan, atasan_jabatan),
          document_masters!inner (nama_dokumen, kategori, is_multiple)
        `, { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (status !== 'Semua') {
        query = query.eq('status_validasi', status);
      }
      
      // Strict hierarchical constraint for detail view
      if (selectedPeriodeId) {
        query = query.eq('periode_id', selectedPeriodeId);
      }
      
      if (!isSuperadminView) {
        if (currentUserJabatan) {
          query = query.eq('users.atasan_jabatan', currentUserJabatan);
        } else {
          query = query.eq('users.atasan_jabatan', '___UNMATCHABLE_STATE___');
        }
      }
      
      // Note: Full text search across relations is tricky in raw Supabase JS.
      // We will rely on document_masters.nama_dokumen for server-side search.
      if (search) {
        query = query.ilike('document_masters.nama_dokumen', `%${search}%`);
      }

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, count, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      
      setDetailSubmissions((data as unknown as SubmissionWithDetails[]) || []);
      setDetailTotalItems(count || 0);
    } catch (err: any) {
      console.error('Error fetching detail submissions:', err);
      alert('Gagal memuat detail dokumen: ' + err.message);
    } finally {
      setDetailLoading(false);
    }
  }, [isSuperadminView, currentUserJabatan, selectedPeriodeId]); // Perbaikan dependensi

  useEffect(() => {
    setSelectedUserId(null);
    fetchMasterSubmissions();
  }, [fetchMasterSubmissions, selectedPeriodeId]);

  useEffect(() => {
    if (selectedUserId) {
      fetchDetailSubmissions(selectedUserId, detailCurrentPage, docSearchQuery, docFilterStatus);
    }
  }, [selectedUserId, detailCurrentPage, docSearchQuery, docFilterStatus, fetchDetailSubmissions, selectedPeriodeId]);

  const usersSummary: UserSummary[] = useMemo(() => {
    const summaryMap = new Map<string, UserSummary>();
    
    submissions.forEach(sub => {
      const userId = sub.users?.id;
      if (!userId) return;
      
      if (!summaryMap.has(userId)) {
        summaryMap.set(userId, {
          userId,
          nama: sub.users?.nama || 'Unknown User',
          jabatan: sub.users?.jabatan || 'Pegawai',
          totalSubmissions: 0,
          pendingCount: 0,
          approvedCount: 0,
          rejectedCount: 0,
          submissions: []
        });
      }
      
      const userStat = summaryMap.get(userId)!;
      userStat.totalSubmissions += 1;
      userStat.submissions.push(sub);
      
      if (sub.status_validasi === 'pending') userStat.pendingCount += 1;
      if (sub.status_validasi === 'approved') userStat.approvedCount += 1;
      if (sub.status_validasi === 'rejected') userStat.rejectedCount += 1;
    });
    
    return Array.from(summaryMap.values()).sort((a, b) => b.pendingCount - a.pendingCount);
  }, [submissions]);

  const filteredUsersSummary = usersSummary.filter(user => {
    const query = userSearchQuery.toLowerCase();
    return user.nama.toLowerCase().includes(query) || user.jabatan.toLowerCase().includes(query);
  });

  const handleExportCSV = () => {
    const headers = ["Nama Pegawai", "Jabatan", "Total Dokumen", "Pending", "Disetujui", "Ditolak"];
    const rows = usersSummary.map(user => [
      `"${user.nama}"`,
      `"${user.jabatan}"`,
      user.totalSubmissions,
      user.pendingCount,
      user.approvedCount,
      user.rejectedCount
    ]);
    
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(row => row.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Rekap_Kinerja_Asesor_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleApprove = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menyetujui dokumen ini?')) return;
    
    const { error: updateError } = await supabase
      .from('submissions')
      .update({ status_validasi: 'approved', catatan: null })
      .eq('id', id);

    if (updateError) {
      alert('Gagal menyetujui dokumen: ' + updateError.message);
    } else {
      if (selectedUserId) {
        fetchDetailSubmissions(selectedUserId, detailCurrentPage, docSearchQuery, docFilterStatus);
      }
      fetchMasterSubmissions();
    }
  };

  const handleReject = async (id: string) => {
    const alasan = window.prompt('Masukkan catatan penolakan:');
    if (alasan === null) return;
    
    if (alasan.trim() === '') {
      alert('Catatan penolakan tidak boleh kosong.');
      return;
    }

    const { error: updateError } = await supabase
      .from('submissions')
      .update({ status_validasi: 'rejected', catatan: alasan })
      .eq('id', id);

    if (updateError) {
      alert('Gagal menolak dokumen: ' + updateError.message);
    } else {
      if (selectedUserId) {
        fetchDetailSubmissions(selectedUserId, detailCurrentPage, docSearchQuery, docFilterStatus);
      }
      fetchMasterSubmissions();
    }
  };

  const handleBulkApprove = async () => {
    if (selectedItems.length === 0) return;
    if (!window.confirm(`Apakah Anda yakin ingin menyetujui ${selectedItems.length} dokumen yang dipilih?`)) return;

    const { error: updateError } = await supabase
      .from('submissions')
      .update({ status_validasi: 'approved', catatan: null })
      .in('id', selectedItems);

    if (updateError) {
      alert('Gagal menyetujui dokumen massal: ' + updateError.message);
    } else {
      setSelectedItems([]);
      if (selectedUserId) {
        fetchDetailSubmissions(selectedUserId, detailCurrentPage, docSearchQuery, docFilterStatus);
      }
      fetchMasterSubmissions();
    }
  };

  const handleBulkReject = async () => {
    if (selectedItems.length === 0) return;
    
    const alasan = window.prompt(`Masukkan catatan penolakan untuk ${selectedItems.length} dokumen yang dipilih:`);
    if (alasan === null) return;
    
    if (alasan.trim() === '') {
      alert('Catatan penolakan tidak boleh kosong.');
      return;
    }

    const { error: updateError } = await supabase
      .from('submissions')
      .update({ status_validasi: 'rejected', catatan: alasan })
      .in('id', selectedItems);

    if (updateError) {
      alert('Gagal menolak dokumen massal: ' + updateError.message);
    } else {
      setSelectedItems([]);
      if (selectedUserId) {
        fetchDetailSubmissions(selectedUserId, detailCurrentPage, docSearchQuery, docFilterStatus);
      }
      fetchMasterSubmissions();
    }
  };

  if (loading && submissions.length === 0) {
    return (
      <div className="p-10 flex justify-center items-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // === DETAIL VIEW (Documents for a single user) ===
  if (selectedUserId) {
    const selectedUser = usersSummary.find(u => u.userId === selectedUserId);
    
    if (!selectedUser) {
      setSelectedUserId(null);
      return null;
    }

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="flex items-center justify-between mb-8 bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div>
            <button 
              onClick={() => setSelectedUserId(null)}
              className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-primary dark:hover:text-secondary transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Staf
            </button>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Users className="w-7 h-7 text-primary dark:text-secondary" />
              Validasi: {selectedUser.nama}
            </h3>
            <p className="text-gray-500 mt-1">{selectedUser.jabatan}</p>
          </div>
          
          <div className="flex gap-4">
            <div className="text-center bg-yellow-50 dark:bg-yellow-900/20 px-4 py-2 rounded-xl border border-yellow-100 dark:border-yellow-800/30">
              <span className="block text-2xl font-bold text-yellow-600 dark:text-yellow-500">{selectedUser.pendingCount}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-700/70 dark:text-yellow-400/70">Pending</span>
            </div>
            <div className="text-center bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-xl border border-green-100 dark:border-green-800/30">
              <span className="block text-2xl font-bold text-green-600 dark:text-green-500">{selectedUser.approvedCount}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-700/70 dark:text-green-400/70">Approved</span>
            </div>
          </div>
        </div>

        {/* Detail View Search & Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-x-auto print:hidden">
          {/* ✨ PERBAIKAN: Hapus larangan Superadmin di tombol persetujuan massal */}
          {isActivePeriode && selectedItems.length > 0 && (
            <div className="flex items-center gap-2 shrink-0 animate-in fade-in zoom-in duration-300">
              <button
                onClick={handleBulkApprove}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all bg-green-600 hover:bg-green-700 text-white shadow-md"
              >
                ✅ Setujui ({selectedItems.length})
              </button>
              <button
                onClick={handleBulkReject}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all bg-red-600 hover:bg-red-700 text-white shadow-lg ring-2 ring-red-500/50 hover:ring-red-500"
              >
                Tolak {selectedItems.length} Dokumen Terpilih
              </button>
            </div>
          )}
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Cari nama dokumen..."
              value={docSearchQuery}
              onChange={(e) => { setDocSearchQuery(e.target.value); setDetailCurrentPage(1); setSelectedItems([]); }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>
          <div className="w-full md:w-48 shrink-0 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="w-4 h-4 text-gray-400" />
            </div>
            <select
              value={docFilterStatus}
              onChange={(e) => setDocFilterStatus(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all cursor-pointer appearance-none"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%236b7280%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem top 50%', backgroundSize: '0.65rem auto' }}
            >
              <option value="Semua">Semua Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Disetujui</option>
              <option value="rejected">Ditolak</option>
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto relative">
            {detailLoading && (
              <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm z-10 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            {(() => {
              const detailTotalPages = Math.ceil(detailTotalItems / itemsPerPage);
              
              const allVisibleSelected = detailSubmissions.length > 0 && detailSubmissions.every(doc => selectedItems.includes(doc.id));
              
              const handleSelectAll = () => {
                if (allVisibleSelected) {
                  setSelectedItems(prev => prev.filter(id => !detailSubmissions.some(d => d.id === id)));
                } else {
                  const visibleIds = detailSubmissions.map(d => d.id);
                  setSelectedItems(prev => Array.from(new Set([...prev, ...visibleIds])));
                }
              };

              const handleSelectItem = (id: string) => {
                setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
              };

              return (
                <>
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-[#024049] text-white">
                      <tr>
                        {/* ✨ PERBAIKAN: Munculkan Kolom Checkbox untuk Superadmin juga */}
                        <th className="px-4 py-3 font-semibold whitespace-nowrap w-12 text-center print:hidden">
                          <input 
                            type="checkbox" 
                            checked={allVisibleSelected}
                            onChange={handleSelectAll}
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                          />
                        </th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Nama Dokumen</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Kategori</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Tipe / Semester</th>
                        <th className="px-4 py-3 font-semibold text-center whitespace-nowrap print:hidden">Link</th>
                        <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">Status</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Catatan</th>
                        {/* ✨ PERBAIKAN: Munculkan Kolom Aksi untuk Superadmin juga */}
                        <th className="px-4 py-3 font-semibold text-center whitespace-nowrap print:hidden">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {detailSubmissions.length > 0 ? (
                        detailSubmissions.map((sub, index) => {
                          const isPending = sub.status_validasi === 'pending';
                          const isApproved = sub.status_validasi === 'approved';
                          const isRejected = sub.status_validasi === 'rejected';
                          const isEven = index % 2 === 0;

                          return (
                            <tr key={sub.id} className={`${isEven ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/30'} hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors`}>
                              {/* ✨ PERBAIKAN: Checkbox Item untuk Superadmin */}
                              <td className="px-4 py-3 text-center print:hidden">
                                <input 
                                  type="checkbox" 
                                  checked={selectedItems.includes(sub.id)}
                                  onChange={() => handleSelectItem(sub.id)}
                                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-[250px]">
                                <div className="truncate" title={sub.document_masters?.nama_dokumen}>
                                  {sub.document_masters?.nama_dokumen}
                                </div>
                                {sub.document_masters?.is_multiple && sub.judul_kustom && (
                                  <div className="text-xs text-primary dark:text-secondary mt-1 truncate" title={sub.judul_kustom}>
                                    {sub.judul_kustom}
                                  </div>
                                )}
                                <div className="text-[10px] text-gray-400 mt-1">
                                  {new Date(sub.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {sub.document_masters?.kategori}
                              </td>
                              <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {sub.semester}
                              </td>
                              <td className="px-4 py-3 text-center print:hidden">
                                <a 
                                  href={sub.url_gdrive} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-dark dark:text-secondary dark:hover:text-secondary-dark font-medium underline"
                                  title={sub.url_gdrive}
                                >
                                  Buka Drive <ExternalLink className="w-3 h-3" />
                                </a>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  isApproved ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400' :
                                  isRejected ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400' :
                                  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400'
                                }`}>
                                  {sub.status_validasi}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 max-w-[150px]">
                                {isRejected && sub.catatan ? (
                                  <span className="text-red-600 dark:text-red-400 font-medium truncate block" title={sub.catatan}>
                                    {sub.catatan}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              {/* ✨ PERBAIKAN: Tombol Approve/Reject akan muncul terlepas dari apakah dia Superadmin atau bukan */}
                              {isActivePeriode && (
                                <td className="px-4 py-3 text-center print:hidden">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {isPending ? (
                                      <>
                                        <button
                                          onClick={() => handleApprove(sub.id)}
                                          className="p-1.5 bg-green-50 dark:bg-green-900/20 text-green-600 hover:bg-green-500 hover:text-white rounded transition-colors border border-green-200 dark:border-green-800/50"
                                          title="Setujui Dokumen"
                                        >
                                          <Check className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => handleReject(sub.id)}
                                          className="p-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-500 hover:text-white rounded transition-colors border border-red-200 dark:border-red-800/50"
                                          title="Tolak Dokumen"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          if(window.confirm('Reset status dokumen ini menjadi Pending?')) {
                                            supabase.from('submissions').update({ status_validasi: 'pending', catatan: null }).eq('id', sub.id).then(() => {
                                              if (selectedUserId) fetchDetailSubmissions(selectedUserId, detailCurrentPage, docSearchQuery, docFilterStatus);
                                              fetchMasterSubmissions();
                                            });
                                          }
                                        }}
                                        className="text-[10px] text-gray-400 hover:text-primary transition-colors font-medium underline"
                                      >
                                        Reset
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-gray-500 bg-gray-50 dark:bg-gray-800/20">
                            Pencarian dokumen tidak ditemukan.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {detailTotalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 print:hidden">
                      <button
                        onClick={() => setDetailCurrentPage(p => Math.max(1, p - 1))}
                        disabled={detailCurrentPage === 1}
                        className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700 transition-colors"
                      >
                        Sebelumnya
                      </button>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Halaman <span className="font-bold text-gray-900 dark:text-white">{detailCurrentPage}</span> dari <span className="font-bold text-gray-900 dark:text-white">{detailTotalPages}</span>
                      </span>
                      <button
                        onClick={() => setDetailCurrentPage(p => Math.min(detailTotalPages, p + 1))}
                        disabled={detailCurrentPage === detailTotalPages}
                        className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700 transition-colors"
                      >
                        Selanjutnya
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  // === MASTER VIEW (List of Users) ===
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 print:block print:absolute print:top-0 print:left-0 print:w-full print:bg-white print:text-black print:z-[9999] print:p-8 print:font-print-body">
      {/* Formal Print Header */}
      <div className="hidden print:block text-black mb-6">
        <div className="flex items-center justify-between border-b-4 border-black pb-4 mb-2">
          <img src="/logo.png" alt="Logo Kampus" className="w-24 h-24 object-contain shrink-0" />
          <div className="flex-1 text-center">
            <h2 className="text-2xl font-extrabold uppercase tracking-wide font-philosopher">UNIVERSITAS AT-TAQWA BONDOWOSO</h2>
            <h1 className="text-lg font-bold uppercase mt-1">REKAPITULASI LAPORAN E-KINERJA</h1>
          </div>
          <div className="w-24 h-24 shrink-0"></div>
        </div>
        <div className="text-left font-bold text-base mt-2">
          <p>Laporan Validasi oleh: {currentUserJabatan || 'Superadmin'}</p>
          <p>Tanggal Cetak: {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-primary/10 dark:bg-secondary/10 rounded-xl shadow-sm">
              <Check className="w-6 h-6 text-primary dark:text-secondary" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Validasi Dokumen</h3>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-lg ml-14">
            Tinjau dan validasi dokumen LKTK yang telah diunggah oleh staf bawahan Anda.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm text-sm font-semibold"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            Cetak PDF
          </button>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors shadow-sm text-sm font-semibold"
          >
            📥 Ekspor Rekap (CSV)
          </button>
          <button 
            onClick={fetchMasterSubmissions}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors shadow-sm text-sm font-semibold text-gray-700 dark:text-gray-300"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl text-red-800 dark:text-red-400 text-sm shadow-sm flex gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <strong>Gagal Memuat Data:</strong> {error}
          </div>
        </div>
      )}

      {/* Master View Search Bar */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm print:hidden">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Cari nama staf atau jabatan..."
            value={userSearchQuery}
            onChange={(e) => { setUserSearchQuery(e.target.value); setMasterCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {(() => {
            const masterTotalPages = Math.ceil(filteredUsersSummary.length / itemsPerPage);
            const masterStartIndex = (masterCurrentPage - 1) * itemsPerPage;
            const currentMasterData = filteredUsersSummary.slice(masterStartIndex, masterStartIndex + itemsPerPage);

            return (
              <>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 border-y border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-3 font-semibold whitespace-nowrap text-gray-700 dark:text-gray-300">Nama Staf</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap text-gray-700 dark:text-gray-300 text-center">Menunggu Validasi</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap text-gray-700 dark:text-gray-300 text-center">Disetujui</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap text-gray-700 dark:text-gray-300 text-center">Ditolak</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap text-gray-700 dark:text-gray-300 text-center print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {currentMasterData.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-gray-500 bg-gray-50 dark:bg-gray-800/20">
                          <div className="flex flex-col items-center justify-center">
                            <FileText className="w-12 h-12 text-gray-300 mb-4" />
                            <p className="text-lg font-medium">{usersSummary.length === 0 ? 'Belum ada staf yang mengunggah dokumen.' : 'Pencarian tidak ditemukan.'}</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      currentMasterData.map((user, index) => {
                        const isEven = index % 2 === 0;
                        return (
                          <tr key={user.userId} className={`${isEven ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/30'} hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary dark:bg-secondary/10 dark:text-secondary flex items-center justify-center font-bold text-sm shrink-0">
                                  {user.nama.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-semibold text-gray-900 dark:text-white">{user.nama}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {user.pendingCount > 0 ? (
                                <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded text-xs font-bold">
                                  {user.pendingCount} Dokumen
                                </span>
                              ) : <span className="text-gray-400 text-sm">-</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-green-600 dark:text-green-400 font-bold text-sm">{user.approvedCount}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-red-600 dark:text-red-400 font-bold text-sm">{user.rejectedCount}</span>
                            </td>
                            <td className="px-4 py-3 text-center print:hidden">
                              <button
                                onClick={() => { setSelectedUserId(user.userId); setDetailCurrentPage(1); setSelectedItems([]); }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-semibold rounded-md transition-colors"
                              >
                                Nilai Dokumen
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                {masterTotalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 print:hidden">
                    <button
                      onClick={() => setMasterCurrentPage(p => Math.max(1, p - 1))}
                      disabled={masterCurrentPage === 1}
                      className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700 transition-colors"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Halaman <span className="font-bold text-gray-900 dark:text-white">{masterCurrentPage}</span> dari <span className="font-bold text-gray-900 dark:text-white">{masterTotalPages}</span>
                    </span>
                    <button
                      onClick={() => setMasterCurrentPage(p => Math.min(masterTotalPages, p + 1))}
                      disabled={masterCurrentPage === masterTotalPages}
                      className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700 transition-colors"
                    >
                      Selanjutnya
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}