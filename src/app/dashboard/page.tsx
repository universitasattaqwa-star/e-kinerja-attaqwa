'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import SubmissionForm from '@/components/SubmissionForm';
import { Badge, ClipboardList, Layers, Activity, Trophy, Menu, LogOut, FileX, Trash2, Users, FileText, Plus, CheckCircle, Settings, Briefcase, Home, Clock, XCircle, Medal, Calendar, Search, Filter } from 'lucide-react';
import ValidasiDokumenView from '@/components/ValidasiDokumenView';
import PengaturanSistemView from '@/components/PengaturanSistemView';
import ManajemenUserView from '@/components/ManajemenUserView';
import ManajemenJabatanView from '@/components/ManajemenJabatanView';
import MasterJabatanView from '@/components/MasterJabatanView';
import MasterPeriodeView from '@/components/MasterPeriodeView';
interface Role {
  id: string | number;
  nama_jabatan: string;
  permissions?: string[];
}

interface DocumentMaster {
  id: string;
  nama_dokumen: string;
  kategori: string;
  is_multiple: boolean;
  target_jabatan: string;
}

interface Submission {
  id: string;
  document_master_id: string;
  url_gdrive: string;
  semester: string;
  status_validasi: string;
  judul_kustom: string | null;
  catatan?: string | null;
  created_at: string;
  periode?: {
    nama_periode: string;
  };
}

const CATEGORIES = [
  { name: 'SK & Kepegawaian', icon: Badge },
  { name: 'Tupoksi', icon: ClipboardList },
  { name: 'Tugas Tambahan', icon: Layers },
  { name: 'Penunjang', icon: Activity },
  { name: 'Prestasi', icon: Trophy }
];

const KATEGORI_OPTIONS = CATEGORIES.map(c => c.name);

export default function DashboardPage() {
  const displayRoleName = (name: string) => name === 'Tenaga Kependidikan' ? 'Pegawai' : name;

  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Dashboard states
  const [documents, setDocuments] = useState<DocumentMaster[]>([]); // Filtered for LKTK
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<string>('Beranda');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeFormDocId, setActiveFormDocId] = useState<string | null>(null);
  
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });

  // User Document Search & Filter
  const [userDocSearchQuery, setUserDocSearchQuery] = useState('');
  const [userDocFilterStatus, setUserDocFilterStatus] = useState('Semua');
  
  // System Settings State
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [supervisorName, setSupervisorName] = useState<string | null>(null);

  // Period states
  const [periodesList, setPeriodesList] = useState<{id: string, nama_periode: string, is_active: boolean}[]>([]);
  const [selectedPeriodeId, setSelectedPeriodeId] = useState<string>('');
  
  const isActivePeriode = periodesList.find(p => p.id === selectedPeriodeId)?.is_active ?? false;

  // Superadmin Management States
  const [documentMastersAll, setDocumentMastersAll] = useState<DocumentMaster[]>([]);
  const [formNamaDokumen, setFormNamaDokumen] = useState('');
  const [formKategori, setFormKategori] = useState(KATEGORI_OPTIONS[0]);
  const [formIsMultiple, setFormIsMultiple] = useState(false);
  const [formTargetJabatan, setFormTargetJabatan] = useState('Semua Jabatan');
  const [masterJabatans, setMasterJabatans] = useState<{id: string; nama_jabatan: string}[]>([]);
  const [systemRoles, setSystemRoles] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Brute force Role Checks (HARD RESET)
  let rawRoleIds = userProfile?.role_ids;
  if (typeof rawRoleIds === 'string') {
     try { rawRoleIds = JSON.parse(rawRoleIds); } catch(e) { rawRoleIds = []; }
  }
  
  const hasRole = (roleArray: any, targetName: string, targetId: string | number) => {
    if (!Array.isArray(roleArray)) return false;
    
    const matchingRoles = systemRoles.filter(r => 
      r.nama_jabatan === targetName || r.nama_role === targetName || String(r.id) === String(targetId)
    );
    const matchingIds = matchingRoles.map(r => String(r.id));
    matchingIds.push(String(targetId));

    return roleArray.some(role => {
      const roleStr = typeof role === 'object' ? String(role.id || role.role_id) : String(role);
      return matchingIds.includes(roleStr) || 
             role === targetName || 
             (typeof role === 'object' && (role.nama === targetName || role.nama_role === targetName || role.nama_jabatan === targetName));
    });
  };
  
  const isSuperadmin = hasRole(rawRoleIds, 'Superadmin', 1) || String(userProfile?.role_id) === '1' || userProfile?.roles?.nama_jabatan === 'Superadmin';
  const isAsesor = hasRole(rawRoleIds, 'Asesor', 2) || String(userProfile?.role_id) === '2' || userProfile?.roles?.nama_jabatan === 'Asesor';

  const router = useRouter();

  const loadInitialData = async () => {
    setLoading(true);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }
    
    setUser(session.user);

    const { data: profile } = await supabase
      .from('users')
      .select('*, roles(nama_jabatan)')
      .eq('id', session.user.id)
      .single();

    // Fetch System Settings
    const { data: settings } = await supabase
      .from('system_settings')
      .select('*')
      .limit(1)
      .single();
    if (settings) {
      setSystemSettings(settings);
    }
    
    // Fetch Master Jabatan
    const { data: jabatans } = await supabase
      .from('master_jabatan')
      .select('id, nama_jabatan')
      .order('nama_jabatan');
    if (jabatans) {
      setMasterJabatans(jabatans);
    }
      
    // Fetch Periodes
    const { data: periodes } = await supabase
      .from('periode')
      .select('*')
      .order('created_at', { ascending: false });
      
    let activePId = '';
    if (periodes && periodes.length > 0) {
      setPeriodesList(periodes);
      const activePeriode = periodes.find(p => p.is_active);
      if (activePeriode) {
        activePId = activePeriode.id;
        setSelectedPeriodeId(activePeriode.id);
      } else {
        activePId = periodes[0].id;
        setSelectedPeriodeId(periodes[0].id);
      }
    }

    if (profile) {
      setUserProfile(profile);
      if (profile.atasan_jabatan) {
        const { data: atasan } = await supabase.from('users').select('nama').eq('jabatan', profile.atasan_jabatan).limit(1).maybeSingle();
        setSupervisorName(atasan ? atasan.nama : null);
      }
      
      // Fetch Roles to map IDs to Names for the hasRole helper
      const { data: rolesData } = await supabase.from('roles').select('*');
      if (rolesData) setSystemRoles(rolesData);

      if (profile) {
        // Fetch Admin/Assessor Stats
        let statsQuery = supabase.from('submissions').select('status_validasi');
        if (activePId) {
          statsQuery = statsQuery.eq('periode_id', activePId);
        }
        const { data: allSubs } = await statsQuery;
        
        if (allSubs) {
          setAdminStats({
            total: allSubs.length,
            pending: allSubs.filter(s => s.status_validasi === 'pending').length,
            approved: allSubs.filter(s => s.status_validasi === 'approved').length,
            rejected: allSubs.filter(s => s.status_validasi === 'rejected').length
          });
        }
      }

      await fetchSubmissions(session.user.id, activePId);
    }
    
    setLoading(false);
  };

  const fetchSubmissions = async (userId: string, targetPeriodeId?: string) => {
    let query = supabase
      .from('submissions')
      .select('*, catatan, periode(nama_periode)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    const pId = targetPeriodeId || selectedPeriodeId;
    if (pId) {
      query = query.eq('periode_id', pId);
    }
      
    const { data: subs } = await query;
    if (subs) setSubmissions(subs);
  };

  const fetchDocumentsForRole = async () => {
    try {
      const userJabatanName = userProfile?.jabatan || 'Belum Diatur';
      
      // Look up the structural position ID
      const { data: jabatanData } = await supabase
        .from('master_jabatan')
        .select('id')
        .eq('nama_jabatan', userJabatanName)
        .maybeSingle();
        
      const userJabatanId = jabatanData?.id;

      // Ensure we match legacy string values, new UUIDs, and 'Semua Jabatan'
      let orQuery = `target_jabatan.eq.${userJabatanName},target_jabatan.eq.Semua Jabatan`;
      if (userJabatanId) {
        orQuery = `target_jabatan.eq.${userJabatanId},${orQuery}`;
      }

      let query = supabase
        .from('document_masters')
        .select('*')
        .or(orQuery);
      
      const { data, error } = await query.order('kategori');

      if (error) throw error;
      setDocuments(data || []);
    } catch (err: any) {
      console.error('Error fetching documents:', err);
    }
  };

  // Dedicated fetch for the Superadmin Data Table
  const fetchDocumentMastersAll = async () => {
    const { data: docs } = await supabase
      .from('document_masters')
      .select('*')
      .order('kategori', { ascending: true })
      .order('nama_dokumen', { ascending: true });
      
    if (docs) {
      setDocumentMastersAll(docs);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (userProfile && selectedPeriodeId) {
      fetchSubmissions(userProfile.id);
      
      if (isSuperadmin || isAsesor) {
        // Re-fetch Admin Stats for the selected period
        const fetchStats = async () => {
          const { data: allSubs } = await supabase.from('submissions').select('status_validasi').eq('periode_id', selectedPeriodeId);
          if (allSubs) {
            setAdminStats({
              total: allSubs.length,
              pending: allSubs.filter(s => s.status_validasi === 'pending').length,
              approved: allSubs.filter(s => s.status_validasi === 'approved').length,
              rejected: allSubs.filter(s => s.status_validasi === 'rejected').length
            });
          }
        };
        fetchStats();
      }
    }
  }, [selectedPeriodeId, userProfile]);

  useEffect(() => {
    const refreshProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase.from('users').select('*, roles(nama_jabatan)').eq('id', session.user.id).single();
        if (profile) {
          setUserProfile(profile);
          if (profile.atasan_jabatan) {
            const { data: atasan } = await supabase.from('users').select('nama').eq('jabatan', profile.atasan_jabatan).limit(1).maybeSingle();
            setSupervisorName(atasan ? atasan.nama : null);
          } else {
            setSupervisorName(null);
          }
        }
      }
    };
    refreshProfile();
  }, [activeTab]);

  useEffect(() => {
    if (userProfile) {
      fetchDocumentsForRole();
      if (isSuperadmin) {
        fetchDocumentMastersAll();
      }
    }
  }, [userProfile]);

  const handleDelete = async (submissionId: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus dokumen ini?")) {
      const { error } = await supabase
        .from('submissions')
        .delete()
        .eq('id', submissionId);

      if (!error) {
        setSubmissions(prev => prev.filter(s => s.id !== submissionId));
      } else {
        alert("Gagal menghapus dokumen: " + error.message);
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Superadmin Handlers
  const handleAddMasterDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNamaDokumen || !formTargetJabatan || !formKategori) return;

    setIsSubmitting(true);
    const { error } = await supabase.from('document_masters').insert({
      nama_dokumen: formNamaDokumen,
      kategori: formKategori,
      is_multiple: formIsMultiple,
      target_jabatan: formTargetJabatan
    });

    if (error) {
      alert("Gagal menambahkan dokumen master: " + error.message);
    } else {
      setFormNamaDokumen('');
      setFormIsMultiple(false);
      fetchDocumentMastersAll(); // Refresh table
    }
    setIsSubmitting(false);
  };

  const handleDeleteMasterDocument = async (id: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus dokumen master ini? Semua submission terkait dokumen ini juga akan terhapus!")) {
      const { error } = await supabase.from('document_masters').delete().eq('id', id);
      if (error) {
        alert("Gagal menghapus dokumen: " + error.message);
      } else {
        fetchDocumentMastersAll(); // Refresh table
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-500 font-medium">Memuat Dashboard...</p>
        </div>
      </div>
    );
  }

  // Filter documents for the active LKTK category
  const filteredDocuments = documents.filter(doc => {
    if (doc.kategori !== activeTab) return false;

    const docSubmissions = submissions.filter(s => s.document_master_id === doc.id);
    
    // Search match
    const matchesSearch = doc.nama_dokumen.toLowerCase().includes(userDocSearchQuery.toLowerCase());
    
    // Status match
    const matchesStatus = userDocFilterStatus === 'Semua' || 
      (userDocFilterStatus === 'kosong' && docSubmissions.length === 0) ||
      docSubmissions.some(s => s.status_validasi === userDocFilterStatus);
      
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      {/* Formal Print Template (Hidden on Web) */}
      {KATEGORI_OPTIONS.includes(activeTab) && (
        <div className="hidden print:block print:absolute print:top-0 print:left-0 print:w-full print:bg-white print:text-black print:z-[9999] print:font-print-body text-sm p-8">
          <div className="flex items-center justify-between border-b-4 border-black pb-4 mb-2">
            <img src="/logo.png" alt="Logo Kampus" className="w-24 h-24 object-contain shrink-0" />
            <div className="flex-1 text-center">
              <h2 className="text-2xl font-extrabold uppercase tracking-wide font-philosopher">UNIVERSITAS AT-TAQWA BONDOWOSO</h2>
              <h1 className="text-lg font-bold uppercase mt-1">BUKTI PENYERAHAN LAPORAN E-KINERJA</h1>
            </div>
            <div className="w-24 h-24 shrink-0"></div>
          </div>
          <div className="text-center mb-6">
            <p className="text-base font-bold">Periode Aktif: {systemSettings?.periode_aktif || '-'}</p>
          </div>
          
          <div className="mb-6">
            <table className="text-base">
              <tbody>
                <tr>
                  <td className="py-1 w-40 font-bold">Nama Lengkap</td>
                  <td className="py-1 w-4">:</td>
                  <td className="py-1">{userProfile?.nama || '-'}</td>
                </tr>
                <tr>
                  <td className="py-1 font-bold">NIDN / NIY</td>
                  <td className="py-1">:</td>
                  <td className="py-1">{userProfile?.niy || '-'}</td>
                </tr>
                <tr>
                  <td className="py-1 font-bold">Jabatan</td>
                  <td className="py-1">:</td>
                  <td className="py-1">{userProfile?.jabatan || 'Belum Diatur'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <table className="w-full border-collapse border border-black text-sm mb-16">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black px-3 py-2 text-center w-12">No</th>
                <th className="border border-black px-3 py-2 text-left">Kategori Dokumen</th>
                <th className="border border-black px-3 py-2 text-left">Nama Dokumen / Link</th>
                <th className="border border-black px-3 py-2 text-center w-28">Status</th>
              </tr>
            </thead>
            <tbody>
              {submissions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border border-black px-3 py-6 text-center italic">Belum ada dokumen yang diserahkan.</td>
                </tr>
              ) : (
                submissions.map((sub, i) => {
                  const docMaster = documents.find(d => d.id === sub.document_master_id);
                  return (
                    <tr key={sub.id}>
                      <td className="border border-black px-3 py-2 text-center">{i + 1}</td>
                      <td className="border border-black px-3 py-2">{docMaster?.kategori || '-'}</td>
                      <td className="border border-black px-3 py-2">
                        <strong>{docMaster?.nama_dokumen || 'Dokumen LKTK'}</strong>
                        <div className="text-xs mt-1 break-all text-blue-600 underline">{sub.url_gdrive}</div>
                      </td>
                      <td className="border border-black px-3 py-2 text-center uppercase text-xs font-bold">
                        {sub.status_validasi === 'approved' ? 'Disetujui' : sub.status_validasi === 'rejected' ? 'Ditolak' : 'Pending'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="flex justify-between px-12 mt-12 text-base">
            <div className="text-center w-64">
              <p>Mengetahui,</p>
              <p>{userProfile?.atasan_jabatan || 'Atasan'}</p>
              <br/><br/><br/><br/>
              {supervisorName ? (
                <p className="font-bold underline">{supervisorName}</p>
              ) : (
                <p className="font-bold underline">...................................................</p>
              )}
            </div>
            <div className="text-center w-64">
              <p>Bondowoso, {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p>Penyusun</p>
              <br/><br/><br/><br/>
              <p className="font-bold underline">{userProfile?.nama || '...................................................'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen print:min-h-0 print:h-auto print:overflow-visible print:bg-white bg-gray-50 dark:bg-gray-950 flex overflow-hidden">
        
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={`print:hidden bg-primary text-white transition-all duration-300 ease-in-out flex flex-col justify-between shrink-0 h-screen z-50 fixed md:sticky top-0 left-0 overflow-x-hidden ${
          isSidebarOpen ? 'translate-x-0 w-80' : '-translate-x-full md:translate-x-0 md:w-20'
        }`}
      >
        {/* Logo Area */}
        <div className="h-auto py-6 flex items-center justify-center border-b border-primary-dark/50 px-4 shrink-0">
          {isSidebarOpen ? (
            <div className="flex flex-col items-center text-center">
              <Image 
                src="/logo-kampus.png" 
                alt="Logo IAI At-Taqwa" 
                width={80}
                height={80}
                className="w-20 h-auto shrink-0 object-contain drop-shadow-md mb-3"
              />
              <h1 className="text-2xl font-extrabold tracking-tight leading-none text-white drop-shadow-sm">Citra At-Taqwa</h1>
              <p className="text-[10px] font-medium text-white/70 mt-1.5 tracking-wide leading-snug px-1 max-w-[200px]">
                (Catatan Integritas dan Transparansi Kinerja)
              </p>
            </div>
          ) : (
            <div className="w-12 h-12 flex items-center justify-center shrink-0">
              <Image 
                src="/logo-kampus.png" 
                alt="Logo IAI At-Taqwa" 
                width={48}
                height={48}
                className="w-full h-auto object-contain drop-shadow-md"
              />
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto py-6 mt-4">
          <ul className="space-y-3 px-4">
            
            {(isAsesor || isSuperadmin) && (
              // ADMIN / ASSESSOR MENUS
              <>
                <li className="px-4 pb-2">
                  <span className={`text-xs font-bold text-secondary-dark uppercase tracking-wider ${!isSidebarOpen && 'hidden'}`}>
                    {isSuperadmin ? 'Menu Admin' : 'Menu Asesor'}
                  </span>
                </li>
                
                {isSuperadmin && (
                  <>
                    <li>
                      <button
                        onClick={() => setActiveTab('Manajemen User')}
                        className={`w-full flex items-center text-left py-3.5 rounded-xl transition-all duration-200 group ${
                          activeTab === 'Manajemen User' 
                            ? 'bg-secondary text-primary-dark font-bold shadow-lg shadow-secondary/20' 
                            : 'text-gray-300 hover:bg-primary-dark hover:text-white font-medium'
                        } ${isSidebarOpen ? 'px-4 justify-start' : 'px-0 justify-center'}`}
                        title="Manajemen User"
                      >
                        <Users className={`shrink-0 w-6 h-6 ${isSidebarOpen ? 'mr-4' : ''} ${activeTab === 'Manajemen User' ? 'text-primary-dark' : 'text-secondary group-hover:text-white transition-colors'}`} />
                        {isSidebarOpen && <span className="text-[15px] leading-snug">Manajemen User</span>}
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setActiveTab('Master Jabatan')}
                        className={`w-full flex items-center text-left py-3.5 rounded-xl transition-all duration-200 group ${
                          activeTab === 'Master Jabatan' 
                            ? 'bg-secondary text-primary-dark font-bold shadow-lg shadow-secondary/20' 
                            : 'text-gray-300 hover:bg-primary-dark hover:text-white font-medium'
                        } ${isSidebarOpen ? 'px-4 justify-start' : 'px-0 justify-center'}`}
                        title="Master Jabatan"
                      >
                        <Briefcase className={`shrink-0 w-6 h-6 ${isSidebarOpen ? 'mr-4' : ''} ${activeTab === 'Master Jabatan' ? 'text-primary-dark' : 'text-secondary group-hover:text-white transition-colors'}`} />
                        {isSidebarOpen && <span className="text-[15px] leading-snug">Master Jabatan</span>}
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setActiveTab('Master Periode')}
                        className={`w-full flex items-center text-left py-3.5 rounded-xl transition-all duration-200 group ${
                          activeTab === 'Master Periode' 
                            ? 'bg-secondary text-primary-dark font-bold shadow-lg shadow-secondary/20' 
                            : 'text-gray-300 hover:bg-primary-dark hover:text-white font-medium'
                        } ${isSidebarOpen ? 'px-4 justify-start' : 'px-0 justify-center'}`}
                        title="Master Periode"
                      >
                        <Calendar className={`shrink-0 w-6 h-6 ${isSidebarOpen ? 'mr-4' : ''} ${activeTab === 'Master Periode' ? 'text-primary-dark' : 'text-secondary group-hover:text-white transition-colors'}`} />
                        {isSidebarOpen && <span className="text-[15px] leading-snug">Master Periode</span>}
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setActiveTab('Manajemen Hak Akses')}
                        className={`w-full flex items-center text-left py-3.5 rounded-xl transition-all duration-200 group ${
                          activeTab === 'Manajemen Hak Akses' 
                            ? 'bg-secondary text-primary-dark font-bold shadow-lg shadow-secondary/20' 
                            : 'text-gray-300 hover:bg-primary-dark hover:text-white font-medium'
                        } ${isSidebarOpen ? 'px-4 justify-start' : 'px-0 justify-center'}`}
                        title="Manajemen Hak Akses"
                      >
                        <Briefcase className={`shrink-0 w-6 h-6 ${isSidebarOpen ? 'mr-4' : ''} ${activeTab === 'Manajemen Hak Akses' ? 'text-primary-dark' : 'text-secondary group-hover:text-white transition-colors'}`} />
                        {isSidebarOpen && <span className="text-[15px] leading-snug">Manajemen Hak Akses</span>}
                      </button>
                    </li>
                  </>
                )}

                {isSuperadmin && (
                  <>
                    <li>
                      <button
                        onClick={() => setActiveTab('Manajemen Dokumen Master')}
                        className={`w-full flex items-center text-left py-3.5 rounded-xl transition-all duration-200 group ${
                          activeTab === 'Manajemen Dokumen Master' 
                            ? 'bg-secondary text-primary-dark font-bold shadow-lg shadow-secondary/20' 
                            : 'text-gray-300 hover:bg-primary-dark hover:text-white font-medium'
                        } ${isSidebarOpen ? 'px-4 justify-start' : 'px-0 justify-center'}`}
                        title="Manajemen Dokumen Master"
                      >
                        <FileText className={`shrink-0 w-6 h-6 ${isSidebarOpen ? 'mr-4' : ''} ${activeTab === 'Manajemen Dokumen Master' ? 'text-primary-dark' : 'text-secondary group-hover:text-white transition-colors'}`} />
                        {isSidebarOpen && <span className="text-[15px] leading-snug">Manajemen Dokumen Master</span>}
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setActiveTab('Pengaturan Sistem')}
                        className={`w-full flex items-center text-left py-3.5 rounded-xl transition-all duration-200 group ${
                          activeTab === 'Pengaturan Sistem' 
                            ? 'bg-secondary text-primary-dark font-bold shadow-lg shadow-secondary/20' 
                            : 'text-gray-300 hover:bg-primary-dark hover:text-white font-medium'
                        } ${isSidebarOpen ? 'px-4 justify-start' : 'px-0 justify-center'}`}
                        title="Pengaturan Sistem"
                      >
                        <Settings className={`shrink-0 w-6 h-6 ${isSidebarOpen ? 'mr-4' : ''} ${activeTab === 'Pengaturan Sistem' ? 'text-primary-dark' : 'text-secondary group-hover:text-white transition-colors'}`} />
                        {isSidebarOpen && <span className="text-[15px] leading-snug">Pengaturan Sistem</span>}
                      </button>
                    </li>
                  </>
                )}
                
                {isAsesor && (
                  <li>
                  <button
                    onClick={() => setActiveTab('Validasi Dokumen')}
                    className={`w-full flex items-center text-left py-3.5 rounded-xl transition-all duration-200 group ${
                      activeTab === 'Validasi Dokumen' 
                        ? 'bg-secondary text-primary-dark font-bold shadow-lg shadow-secondary/20' 
                        : 'text-gray-300 hover:bg-primary-dark hover:text-white font-medium'
                    } ${isSidebarOpen ? 'px-4 justify-start' : 'px-0 justify-center'}`}
                    title="Validasi Dokumen"
                  >
                    <CheckCircle className={`shrink-0 w-6 h-6 ${isSidebarOpen ? 'mr-4' : ''} ${activeTab === 'Validasi Dokumen' ? 'text-primary-dark' : 'text-secondary group-hover:text-white transition-colors'}`} />
                    {isSidebarOpen && <span className="text-[15px] leading-snug">Validasi Dokumen</span>}
                  </button>
                </li>
                )}
              </>
            )}

            <div className="py-4">
                <ul className="space-y-1.5">
                  <li className="px-4 pb-2">
                    <span className={`text-xs font-bold text-secondary-dark uppercase tracking-wider ${!isSidebarOpen && 'hidden'}`}>
                      Menu Utama
                    </span>
                  </li>

                  {/* BERANDA TAB */}
                  <li>
                    <button
                      onClick={() => setActiveTab('Beranda')}
                      className={`w-full flex items-center text-left py-3.5 rounded-xl transition-all duration-200 group ${
                        activeTab === 'Beranda' 
                          ? 'bg-secondary text-primary-dark font-bold shadow-lg shadow-secondary/20' 
                          : 'text-gray-300 hover:bg-primary-dark hover:text-white font-medium'
                      } ${isSidebarOpen ? 'px-4 justify-start' : 'px-0 justify-center'}`}
                      title="Beranda"
                    >
                      <Home className={`shrink-0 w-6 h-6 ${isSidebarOpen ? 'mr-4' : ''} ${activeTab === 'Beranda' ? 'text-primary-dark' : 'text-secondary group-hover:text-white transition-colors'}`} />
                      {isSidebarOpen && <span className="text-[15px] leading-snug">Beranda / Dasbor</span>}
                    </button>
                  </li>

                  {CATEGORIES.map((category) => {
                  const Icon = category.icon;
                  const isActive = activeTab === category.name;
                  
                  return (
                    <li key={category.name}>
                      <button
                        onClick={() => setActiveTab(category.name)}
                        className={`w-full flex items-center text-left py-3.5 rounded-xl transition-all duration-200 group ${
                          isActive 
                            ? 'bg-secondary text-primary-dark font-bold shadow-lg shadow-secondary/20' 
                            : 'text-gray-300 hover:bg-primary-dark hover:text-white font-medium'
                        } ${isSidebarOpen ? 'px-4 justify-start' : 'px-0 justify-center'}`}
                        title={category.name}
                      >
                        <Icon className={`shrink-0 w-6 h-6 ${isSidebarOpen ? 'mr-4' : ''} ${isActive ? 'text-primary-dark' : 'text-secondary group-hover:text-white transition-colors'}`} />
                        {isSidebarOpen && <span className="text-[15px] leading-snug">{category.name}</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </ul>
        </div>

        {/* Bottom Section (Logout & Footer) */}
        <div className="mt-auto px-4 pb-6 pt-4 border-t border-primary-dark/50 flex flex-col gap-4">
          <button 
            onClick={handleLogout}
            className={`flex items-center text-red-300 hover:text-white hover:bg-red-500/20 p-3 rounded-xl transition-colors w-full ${isSidebarOpen ? 'justify-start px-4' : 'justify-center px-0'}`}
            title="Logout"
          >
            <LogOut className={`w-5 h-5 shrink-0 ${isSidebarOpen && 'mr-3'}`} />
            {isSidebarOpen && <span className="font-bold text-sm text-left leading-snug">Logout</span>}
          </button>
          
          {/* Developer Footer */}
          {isSidebarOpen && (
            <div className="text-center mt-2">
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider leading-relaxed opacity-70">
                Developed by IT Team of<br/>Universitas At-Taqwa Bondowoso
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="w-full flex-1 flex flex-col h-screen print:h-auto print:overflow-visible print:bg-white overflow-x-hidden bg-gray-50 dark:bg-gray-950">
        
        {/* Top Header / Persistent Navbar */}
        <header className="print:hidden h-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-6 shrink-0 z-30 shadow-sm relative justify-between">
          
          <div className="flex items-center">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
              title="Toggle Sidebar"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="ml-6 hidden sm:block">
              <h1 className="text-2xl font-extrabold text-primary dark:text-white leading-none tracking-tight">Citra At-Taqwa</h1>
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 mt-1.5 leading-none tracking-wide">
                (Catatan Integritas dan Transparansi Kinerja)
              </p>
            </div>
          </div>

          {/* Right Side Navigation (Period Selection + User Profile) */}
          <div className="flex items-center gap-6">
            
            {/* Period Selection */}
            {periodesList.length > 0 && (
              <div className="hidden md:flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Periode:</span>
                <select
                  value={selectedPeriodeId}
                  onChange={(e) => setSelectedPeriodeId(e.target.value)}
                  className="bg-transparent text-sm font-bold text-primary dark:text-white border-none focus:ring-0 cursor-pointer outline-none p-0"
                >
                  {periodesList.map(p => (
                    <option key={p.id} value={p.id}>{p.nama_periode} {p.is_active ? '(Aktif)' : ''}</option>
                  ))}
                </select>
              </div>
            )}

            {/* User Profile info */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="font-bold text-gray-900 dark:text-white text-sm leading-tight">
                  {userProfile?.nama || 'User'}
                </span>
                <span className="text-[10px] font-bold text-secondary-dark bg-secondary/10 px-2 py-0.5 rounded-md uppercase tracking-wider">
                  {displayRoleName(userProfile?.jabatan || 'Belum Diatur')}
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold shadow-md">
                {userProfile?.nama?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>

          </div>
        </header>

        {/* Content Scrollable Area */}
        <main className="flex-1 overflow-y-auto print:overflow-visible print:p-0 p-6 md:p-10 relative">
          
          {/* Universal Greeting Banner */}
          <div className="print:hidden mb-8 bg-gradient-to-r from-primary to-primary-dark rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 right-20 -mb-10 w-24 h-24 bg-secondary opacity-20 rounded-full blur-xl"></div>
            <h2 className="text-3xl font-bold mb-2 relative z-10">Selamat Datang di Citra At-Taqwa, {userProfile?.nama || 'User'}!</h2>
            <p className="text-white/80 text-lg max-w-2xl relative z-10">
              {isSuperadmin 
                ? 'Anda memiliki akses Mode Admin. Silakan gunakan menu di sidebar untuk mengelola sistem.'
                : `Anda sedang berada di Dasbor E-Kinerja.`}
            </p>
          </div>

          {/* BERANDA TAB */}
          {activeTab === 'Beranda' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Total Submission', val: (isSuperadmin || isAsesor) ? adminStats.total : submissions.length, icon: FileText, color: 'text-blue-500' },
                  { label: 'Menunggu Validasi', val: (isSuperadmin || isAsesor) ? adminStats.pending : submissions.filter(s => s.status_validasi === 'pending').length, icon: Clock, color: 'text-yellow-500' },
                  { label: 'Disetujui', val: (isSuperadmin || isAsesor) ? adminStats.approved : submissions.filter(s => s.status_validasi === 'approved').length, icon: CheckCircle, color: 'text-green-500' },
                  { label: 'Ditolak', val: (isSuperadmin || isAsesor) ? adminStats.rejected : submissions.filter(s => s.status_validasi === 'rejected').length, icon: XCircle, color: 'text-red-500' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                    <div className={`p-3 rounded-xl bg-gray-100 dark:bg-gray-800 ${stat.color}`}>
                      <stat.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">{stat.label}</p>
                      <p className="text-2xl font-black text-gray-900 dark:text-white">{stat.val}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Announcements & Leaderboard */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-blue-500 opacity-5 rounded-full blur-2xl pointer-events-none"></div>
                  <div>
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Calendar className="text-primary" /> Informasi Periode E-Kinerja</h3>
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                      <p className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Periode Terpilih</p>
                      <p className="text-2xl font-black text-gray-900 dark:text-white mb-4">
                        {periodesList.find(p => p.id === selectedPeriodeId)?.nama_periode || 'Memuat...'} 
                        {isActivePeriode ? ' (Aktif)' : ' (Non-Aktif)'}
                      </p>
                      
                      <p className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Batas Waktu Pengumpulan</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                        {systemSettings?.batas_waktu ? new Date(systemSettings.batas_waktu).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' }) : 'Tidak Ditentukan'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl border border-yellow-200 dark:border-yellow-900/30 text-yellow-800 dark:text-yellow-400">
                    <Clock className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium leading-relaxed">
                      Harap segera melengkapi dan mengunggah dokumen persyaratan E-kinerja Anda sebelum batas waktu berakhir untuk menghindari keterlambatan validasi.
                    </p>
                  </div>
                </div>

                {isSuperadmin && (
                <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-yellow-500 opacity-5 rounded-full blur-2xl pointer-events-none"></div>
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Medal className="text-yellow-500" /> Pegawai Teladan (Top 5)</h3>
                  <div className="space-y-4 relative z-10">
                    {leaderboard?.length > 0 ? leaderboard.map((item, i) => (
                      <div key={i} className="flex items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors">
                        <span className={`w-10 h-10 flex items-center justify-center rounded-full font-bold text-lg shadow-sm ${
                          i === 0 ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-white' : 
                          i === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' : 
                          i === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white' : 
                          'bg-gray-100 dark:bg-gray-800 text-gray-500'
                        }`}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                        </span>
                        <div className="flex-1">
                          <p className="font-bold text-sm text-gray-900 dark:text-white">{item.nama_lengkap}</p>
                          <p className="text-xs font-semibold text-green-600 dark:text-green-400">{item.total_disetujui} Dokumen Disetujui</p>
                        </div>
                      </div>
                    )) : <p className="text-gray-500 italic p-4 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">Papan peringkat sedang disiapkan.</p>}
                  </div>
                </div>
                )}
              </div>
            </div>
          )}

          {/* CONDITIONAL RENDERING BASED ON TABS */}
          {activeTab === 'Manajemen Dokumen Master' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 bg-primary/10 dark:bg-secondary/10 rounded-xl shadow-sm">
                    <FileText className="w-6 h-6 text-primary dark:text-secondary" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Dokumen Master</h3>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-lg ml-14">
                  Kelola daftar persyaratan LKTK untuk berbagai peran/jabatan.
                </p>
              </div>

              {/* Form Tambah Dokumen */}
              <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <Plus className="w-6 h-6 text-secondary" /> Tambah Dokumen Master Baru
                </h3>
                <form onSubmit={handleAddMasterDocument} className="space-y-6 max-w-4xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Nama Dokumen</label>
                      <input 
                        type="text" 
                        required
                        value={formNamaDokumen}
                        onChange={(e) => setFormNamaDokumen(e.target.value)}
                        placeholder="Contoh: SK Mengajar Ganjil"
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-secondary focus:border-transparent transition-all"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Diperuntukkan untuk Jabatan</label>
                      <select 
                        required
                        value={formTargetJabatan}
                        onChange={(e) => setFormTargetJabatan(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-secondary focus:border-transparent transition-all"
                      >
                        <option value="Semua Jabatan">Semua Jabatan (Universal)</option>
                        {masterJabatans.map(j => (
                          <option key={j.id} value={j.id}>{j.nama_jabatan}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Kategori</label>
                      <select 
                        required
                        value={formKategori}
                        onChange={(e) => setFormKategori(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-secondary focus:border-transparent transition-all"
                      >
                        {KATEGORI_OPTIONS.map(k => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="space-y-2 flex flex-col justify-center">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Tipe Inputan</label>
                      <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-fit">
                        <input 
                          type="checkbox" 
                          checked={formIsMultiple}
                          onChange={(e) => setFormIsMultiple(e.target.checked)}
                          className="w-5 h-5 text-primary bg-white border-gray-300 rounded focus:ring-primary dark:focus:ring-secondary"
                        />
                        <span className="text-gray-700 dark:text-gray-300 font-medium">Bisa ditambahkan berulang oleh user? (is_multiple)</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="px-6 py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl transition-all shadow-md shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Menyimpan...</>
                      ) : (
                        <><Plus className="w-5 h-5" /> Simpan Dokumen Master</>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Tabel Dokumen Master */}
              <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Daftar Semua Dokumen Master</h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 border-y border-gray-200 dark:border-gray-700">
                        <th className="px-4 py-4 font-bold text-gray-700 dark:text-gray-300">Nama Dokumen</th>
                        <th className="px-4 py-4 font-bold text-gray-700 dark:text-gray-300">Kategori</th>
                        <th className="px-4 py-4 font-bold text-gray-700 dark:text-gray-300">Jabatan</th>
                        <th className="px-4 py-4 font-bold text-gray-700 dark:text-gray-300 text-center">Berulang</th>
                        <th className="px-4 py-4 font-bold text-gray-700 dark:text-gray-300 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {documentMastersAll.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Belum ada dokumen master yang ditambahkan.</td>
                        </tr>
                      ) : (
                        documentMastersAll.map((doc) => (
                          <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                            <td className="px-4 py-4 font-medium text-gray-900 dark:text-white">{doc.nama_dokumen}</td>
                            <td className="px-4 py-4 text-gray-600 dark:text-gray-400">{doc.kategori}</td>
                            <td className="px-4 py-4">
                              <span className={`inline-block px-3 py-1 font-bold rounded-lg text-xs tracking-wide ${!doc.target_jabatan || doc.target_jabatan === 'Semua Jabatan' ? 'bg-gray-100 text-gray-500 italic' : 'bg-secondary/20 text-secondary-dark'}`}>
                                {doc.target_jabatan === 'Semua Jabatan' ? 'Semua Jabatan' : (masterJabatans.find(j => j.id === doc.target_jabatan)?.nama_jabatan || doc.target_jabatan)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              {doc.is_multiple ? (
                                <span className="inline-block px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">Ya</span>
                              ) : (
                                <span className="inline-block px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs font-bold">Tidak</span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <button
                                onClick={() => handleDeleteMasterDocument(doc.id)}
                                className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Hapus Dokumen"
                              >
                                <Trash2 className="w-5 h-5 mx-auto" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Pengaturan Sistem' && (
            <PengaturanSistemView key="pengaturan" />
          )}

          {activeTab === 'Manajemen User' && (
            <ManajemenUserView key="user" />
          )}

          {activeTab === 'Manajemen Hak Akses' && (
            <ManajemenJabatanView key="jabatan" />
          )}

          {activeTab === 'Master Jabatan' && (
            <MasterJabatanView key="masterjabatan" />
          )}

          {activeTab === 'Master Periode' && (
            <MasterPeriodeView key="masterperiode" />
          )}

          {activeTab === 'Validasi Dokumen' && (isAsesor || isSuperadmin) && (
            <ValidasiDokumenView 
              key="validasi" 
              isSuperadminView={isSuperadmin} 
              currentUserId={userProfile?.id}
              currentUserJabatan={userProfile?.jabatan}
              selectedPeriodeId={selectedPeriodeId}
              isActivePeriode={isActivePeriode}
            />
          )}

          {/* Regular LKTK User View */}
          {KATEGORI_OPTIONS.includes(activeTab) && (
            <div key={`lktk-${activeTab}`} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Submission Deadline Lock Banner */}
              {systemSettings && systemSettings.batas_waktu && new Date() > new Date(systemSettings.batas_waktu) && (
                <div className="print:hidden mb-6 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <FileX className="h-5 w-5 text-red-500" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-bold text-red-800 dark:text-red-400">
                        Periode Pelaporan {systemSettings.periode_aktif} Telah Ditutup pada {new Date(systemSettings.batas_waktu).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                        Anda tidak dapat menambahkan dokumen baru, namun masih dapat melihat dokumen yang telah Anda unggah sebelumnya.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Category Header */}
              <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 dark:bg-secondary/10 rounded-xl shadow-sm print:hidden">
                    {(() => {
                      const CategoryIcon = CATEGORIES.find(c => c.name === activeTab)?.icon || Layers;
                      return <CategoryIcon className="w-6 h-6 text-primary dark:text-secondary" />;
                    })()}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white print:text-xl">Kategori: {activeTab}</h3>
                </div>
                <button
                  onClick={() => window.print()}
                  className="print:hidden flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm text-sm font-semibold"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                  Cetak Bukti E-Kinerja (PDF)
                </button>
              </div>

              {/* User View Search & Filter */}
              <div className="flex flex-col md:flex-row gap-4 mb-6 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm print:hidden">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Cari nama dokumen..."
                    value={userDocSearchQuery}
                    onChange={(e) => setUserDocSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div className="w-full md:w-48 shrink-0 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Filter className="w-4 h-4 text-gray-400" />
                  </div>
                  <select
                    value={userDocFilterStatus}
                    onChange={(e) => setUserDocFilterStatus(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all cursor-pointer appearance-none"
                    style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%236b7280%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem top 50%', backgroundSize: '0.65rem auto' }}
                  >
                    <option value="Semua">Semua Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Disetujui</option>
                    <option value="rejected">Ditolak</option>
                    <option value="kosong">Belum Diunggah</option>
                  </select>
                </div>
              </div>

              {/* Documents List */}
              {filteredDocuments.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 rounded-3xl p-16 text-center border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="w-24 h-24 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileX className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Tidak Ada Dokumen</h3>
                  <p className="text-gray-500 mt-2 text-lg">
                    {isSuperadmin 
                      ? `Tidak ada dokumen master ditemukan untuk kategori ini. Jika seharusnya ada, pastikan kebijakan RLS (Row Level Security) di Supabase mengizinkan Superadmin membaca tabel document_masters.`
                      : `Belum ada persyaratan dokumen untuk kategori ini.`}
                  </p>
                </div>
              ) : (
                <div className="grid gap-8 xl:grid-cols-2">
                  {filteredDocuments.map((doc) => {
                    const docSubmissions = submissions.filter(s => s.document_master_id === doc.id);
                    const canAddMore = doc.is_multiple || docSubmissions.length === 0;
                    const showForm = activeFormDocId === doc.id || (docSubmissions.length === 0 && !doc.is_multiple);
                    
                    return (
                      <div key={doc.id} className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex justify-between items-start gap-4">
                          <h3 className="font-bold text-xl text-gray-900 dark:text-white">
                            {doc.nama_dokumen}
                          </h3>
                          {doc.is_multiple && (
                            <span className="px-3 py-1.5 bg-secondary/10 text-secondary-dark text-xs font-bold rounded-lg uppercase tracking-wider whitespace-nowrap shrink-0 border border-secondary/20">
                              Banyak Data
                            </span>
                          )}
                        </div>
                        
                        <div className="p-6 flex-grow flex flex-col justify-between">
                          <div className="space-y-4">
                            {docSubmissions.length > 0 && (
                              <div className="space-y-4 mb-6">
                                {docSubmissions.map((submission, idx) => (
                                  <div key={submission.id} className="bg-gray-50 dark:bg-gray-800/60 p-5 rounded-2xl border border-gray-200 dark:border-gray-700">
                                    {doc.is_multiple && submission.judul_kustom && (
                                      <h4 className="font-bold text-primary dark:text-secondary text-lg mb-4 flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 bg-secondary rounded-full"></span>
                                        {submission.judul_kustom}
                                      </h4>
                                    )}
                                    {!doc.is_multiple && docSubmissions.length > 1 && (
                                      <h4 className="font-bold text-primary dark:text-secondary text-lg mb-4 flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 bg-secondary rounded-full"></span>
                                        Data #{docSubmissions.length - idx}
                                      </h4>
                                    )}
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <span className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Status Validasi</span>
                                        <span className={`inline-block px-3.5 py-1.5 rounded-lg text-sm font-bold ${
                                          submission.status_validasi === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800/50' :
                                          submission.status_validasi === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800/50' :
                                          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800/50'
                                        }`}>
                                          {submission.status_validasi.charAt(0).toUpperCase() + submission.status_validasi.slice(1)}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Semester</span>
                                        <span className="text-gray-900 dark:text-white font-semibold">{submission.periode?.nama_periode || submission.semester}</span>
                                      </div>
                                    </div>
                                    
                                    {submission.status_validasi === 'rejected' && submission.catatan && (
                                      <div className="mt-4 p-3.5 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800/30 text-sm text-red-700 dark:text-red-400 shadow-sm">
                                        <strong className="block text-[11px] font-bold text-red-800/70 dark:text-red-400/70 uppercase tracking-wider mb-1.5">Alasan Penolakan:</strong>
                                        <p className="font-medium">{submission.catatan}</p>
                                      </div>
                                    )}

                                      {/* Action Buttons (Hidden during Print) */}
                                      <div className="print:hidden mt-5 pt-5 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4">
                                        <a 
                                          href={submission.url_gdrive} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-2 text-primary hover:text-primary-dark dark:text-secondary dark:hover:text-secondary-dark font-bold group bg-white dark:bg-gray-900 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-secondary transition-all shadow-sm flex-1 justify-center"
                                        >
                                          <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                          Buka Google Drive
                                        </a>
                                        {isActivePeriode && (
                                          <button
                                            onClick={() => handleDelete(submission.id)}
                                            title="Hapus Dokumen"
                                            className="p-2.5 bg-red-50 dark:bg-red-900/20 text-red-500 hover:text-white hover:bg-red-500 rounded-xl transition-colors border border-red-100 dark:border-red-900/30 flex-shrink-0"
                                          >
                                            <Trash2 className="w-5 h-5" />
                                          </button>
                                        )}
                                      </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {canAddMore && !showForm && (
                              <button
                                onClick={() => setActiveFormDocId(doc.id)}
                                disabled={!isActivePeriode || (systemSettings && systemSettings.batas_waktu ? new Date() > new Date(systemSettings.batas_waktu) : false)}
                                className={`print:hidden w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed rounded-2xl transition-all font-bold ${
                                  (!isActivePeriode || (systemSettings && systemSettings.batas_waktu && new Date() > new Date(systemSettings.batas_waktu)))
                                    ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed dark:border-gray-800 dark:bg-gray-900/50'
                                    : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary hover:text-primary dark:hover:border-secondary dark:hover:text-secondary hover:bg-primary/5 dark:hover:bg-secondary/5'
                                }`}
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                </svg>
                                {isActivePeriode ? 'Tambah Data Baru' : 'Periode Tidak Aktif'}
                              </button>
                            )}
                            
                            {showForm && isActivePeriode && (
                              <div className={docSubmissions.length > 0 ? "pt-2" : ""}>
                                <SubmissionForm 
                                  documentMasterId={doc.id} 
                                  userId={user.id} 
                                  isMultiple={doc.is_multiple}
                                  isLocked={!isActivePeriode || (systemSettings && systemSettings.batas_waktu ? new Date() > new Date(systemSettings.batas_waktu) : false)}
                                  periodeAktifId={selectedPeriodeId}
                                  onSuccess={() => {
                                    setActiveFormDocId(null);
                                    fetchSubmissions(user.id);
                                  }} 
                                  onCancel={docSubmissions.length > 0 ? () => setActiveFormDocId(null) : undefined}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
    </>
  );
}
