'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, Plus, Trash2, Edit2, CheckCircle2, AlertCircle, RefreshCw, FileText, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
interface Periode {
  id: string;
  nama_periode: string;
  is_active: boolean;
  created_at: string;
}

export default function MasterPeriodeView() {
  const [periodes, setPeriodes] = useState<Periode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [namaPeriode, setNamaPeriode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchPeriodes();
  }, []);

  const fetchPeriodes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('periode')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPeriodes(data || []);
    } catch (err: any) {
      setError('Gagal memuat data periode: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (periode?: Periode) => {
    setError(null);
    if (periode) {
      setEditingId(periode.id);
      setNamaPeriode(periode.nama_periode);
    } else {
      setEditingId(null);
      setNamaPeriode('');
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setNamaPeriode('');
    setIsSubmitting(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaPeriode.trim()) {
      setError('Nama periode tidak boleh kosong');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingId) {
        // Update
        const { error: updateError } = await supabase
          .from('periode')
          .update({ nama_periode: namaPeriode.trim() })
          .eq('id', editingId);
        
        if (updateError) throw updateError;
      } else {
        // Insert (default is_active is false from DB schema)
        const { error: insertError } = await supabase
          .from('periode')
          .insert([{ nama_periode: namaPeriode.trim() }]);
        
        if (insertError) throw insertError;
      }

      await fetchPeriodes();
      handleCloseModal();
    } catch (err: any) {
      setError('Gagal menyimpan periode: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, nama: string) => {
    if (!confirm(`Hapus periode "${nama}"? Aksi ini mungkin akan membuat dokumen yang terkait menjadi kehilangan referensi periode.`)) return;

    try {
      const { error } = await supabase
        .from('periode')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setPeriodes(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      alert('Gagal menghapus periode: ' + err.message);
    }
  };

  const handleSetActive = async (id: string, nama: string) => {
    if (!confirm(`Jadikan periode "${nama}" sebagai periode aktif saat ini? Semua dokumen baru akan masuk ke periode ini.`)) return;

    try {
      // Step 1: Set ALL periods to false
      const { error: resetError } = await supabase
        .from('periode')
        .update({ is_active: false })
        .neq('id', id);

      if (resetError) throw resetError;

      // Step 2: Set the selected period to true
      const { error: activeError } = await supabase
        .from('periode')
        .update({ is_active: true })
        .eq('id', id);

      if (activeError) throw activeError;
      
      // Refresh to see the updated statuses
      await fetchPeriodes();
      alert(`Periode "${nama}" berhasil diaktifkan!`);
    } catch (err: any) {
      alert('Gagal mengaktifkan periode: ' + err.message);
    }
  };

  const fetchExportData = async () => {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        created_at,
        status_validasi,
        url_gdrive,
        semester,
        periode (
          nama_periode
        ),
        users (
          nama
        )
      `);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    // Sort data in JS by Period Name then User Name
    return [...data].sort((a: any, b: any) => {
      const pA = a.periode?.nama_periode || a.semester || '';
      const pB = b.periode?.nama_periode || b.semester || '';
      if (pA !== pB) return pA.localeCompare(pB);
      
      const nA = a.users?.nama || '';
      const nB = b.users?.nama || '';
      return nA.localeCompare(nB);
    });
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const sortedData = await fetchExportData();
      if (!sortedData) {
        alert('Tidak ada data untuk diexport.');
        return;
      }

      let csvContent = 'No,Nama Dosen,Periode,Status Validasi,Link Google Drive,Tanggal Upload\n';

      sortedData.forEach((row: any, index: number) => {
        const no = index + 1;
        const namaDosen = `"${(row.users?.nama || '').replace(/"/g, '""')}"`;
        const periode = `"${(row.periode?.nama_periode || row.semester || '').replace(/"/g, '""')}"`;
        const status = `"${(row.status_validasi || '').replace(/"/g, '""')}"`;
        const link = `"${(row.url_gdrive || '').replace(/"/g, '""')}"`;
        const tanggal = `"${new Date(row.created_at).toLocaleDateString('id-ID')}"`;
        
        csvContent += `${no},${namaDosen},${periode},${status},${link},${tanggal}\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const linkDownload = document.createElement('a');
      linkDownload.setAttribute('href', url);
      linkDownload.setAttribute('download', 'Rekap_Akreditasi_E_Kinerja.csv');
      document.body.appendChild(linkDownload);
      linkDownload.click();
      document.body.removeChild(linkDownload);
    } catch (err: any) {
      alert('Gagal mengekspor data: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const sortedData = await fetchExportData();
      if (!sortedData) {
        alert('Tidak ada data untuk diexport.');
        return;
      }

      const doc = new jsPDF('landscape', 'pt', 'a4');
      
      doc.setFontSize(16);
      doc.text('REKAPITULASI DOKUMEN E-KINERJA', 40, 40);
      doc.setFontSize(14);
      doc.text('Universitas At-Taqwa', 40, 60);
      
      doc.setFontSize(10);
      const printDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
      doc.text(`Tanggal Cetak: ${printDate}`, 40, 80);
      
      const tableColumn = ["No", "Nama Dosen", "Periode", "Link G-Drive", "Status Validasi", "Tanggal Submit"];
      const tableRows: any[] = [];
      
      sortedData.forEach((row: any, index: number) => {
        const rowData = [
          index + 1,
          row.users?.nama || '-',
          row.periode?.nama_periode || row.semester || '-',
          row.url_gdrive || '-',
          row.status_validasi || '-',
          new Date(row.created_at).toLocaleDateString('id-ID')
        ];
        tableRows.push(rowData);
      });
      
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 100,
        headStyles: { fillColor: '#004d40', textColor: '#ffffff' },
        styles: { fontSize: 9 },
      });
      
      doc.save('Rekap_Akreditasi_E_Kinerja.pdf');

    } catch (err: any) {
      alert('Gagal mengekspor data: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  if (loading && periodes.length === 0) {
    return (
      <div className="flex justify-center p-12">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 dark:bg-secondary/10 rounded-xl shadow-sm">
            <Calendar className="w-6 h-6 text-primary dark:text-secondary" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Master Periode</h3>
            <p className="text-sm text-gray-500">Kelola periode akademik untuk pengarsipan laporan</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl transition-colors shadow-sm text-sm font-semibold whitespace-nowrap"
          >
            {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Unduh Excel/CSV
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl transition-colors shadow-sm text-sm font-semibold whitespace-nowrap"
          >
            {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Cetak PDF
          </button>
          
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl transition-colors shadow-sm text-sm font-semibold whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Tambah Periode
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-6 py-4 font-semibold">Nama Periode</th>
                <th className="px-6 py-4 font-semibold text-center w-32">Status</th>
                <th className="px-6 py-4 font-semibold text-center w-40">Aksi Aktifkan</th>
                <th className="px-6 py-4 font-semibold text-right w-32">Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {periodes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Belum ada data periode.
                  </td>
                </tr>
              ) : (
                periodes.map(periode => (
                  <tr key={periode.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {periode.nama_periode}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {periode.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          Non-Aktif
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {periode.is_active ? (
                        <span className="text-xs font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg cursor-not-allowed border border-gray-200 dark:border-gray-700">
                          Sedang Aktif
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSetActive(periode.id, periode.nama_periode)}
                          className="text-xs font-semibold text-primary hover:text-white bg-primary/10 hover:bg-primary px-3 py-1.5 rounded-lg transition-colors border border-primary/20 hover:border-primary shadow-sm"
                        >
                          Jadikan Aktif
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(periode)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(periode.id, periode.nama_periode)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Hapus"
                          disabled={periode.is_active} // Optional: prevent deleting active period
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingId ? 'Edit Periode' : 'Tambah Periode Baru'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6">
              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl text-red-800 dark:text-red-400 text-sm flex gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Nama Periode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={namaPeriode}
                    onChange={e => setNamaPeriode(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                    placeholder="Contoh: Genap 2025/2026"
                    required
                  />
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {editingId ? 'Simpan' : 'Tambahkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
