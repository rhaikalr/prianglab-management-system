import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  Filter,
  Calendar,
  FileSpreadsheet,
  Download,
  Boxes,
  PackagePlus,
  PackageMinus,
  Barcode,
  RotateCcw,
  CheckCircle2,
  X,
} from 'lucide-react';
import { ActivityLog, ActivityType, DateFilterPreset } from '../types';
import { exportToExcel, exportToCSV } from '../utils/export';
import { useAuth } from '../context/AuthContext';
import { inventoryStore } from '../lib/inventoryStore';

interface ActivityLogsViewProps {
  logs: ActivityLog[];
}

export const ActivityLogsView: React.FC<ActivityLogsViewProps> = ({ logs }) => {
  const { currentUser } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [dateFilterPreset, setDateFilterPreset] = useState<DateFilterPreset>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isConfirmClearModalOpen, setIsConfirmClearModalOpen] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search
      const search = searchTerm.toLowerCase();
      const matchSearch =
        log.details.toLowerCase().includes(search) ||
        log.user.toLowerCase().includes(search) ||
        (log.sku && log.sku.toLowerCase().includes(search)) ||
        (log.productName && log.productName.toLowerCase().includes(search));

      // Type
      const matchType = typeFilter === 'ALL' || log.type === typeFilter;

      // Date
      const logDate = new Date(log.createdAt);
      const now = new Date();
      let matchDate = true;

      if (dateFilterPreset === 'TODAY') {
        matchDate = logDate.toDateString() === now.toDateString();
      } else if (dateFilterPreset === 'WEEK') {
        const d = new Date();
        d.setDate(now.getDate() - 7);
        matchDate = logDate >= d;
      } else if (dateFilterPreset === 'MONTH') {
        const d = new Date();
        d.setDate(now.getDate() - 30);
        matchDate = logDate >= d;
      } else if (dateFilterPreset === '3_MONTHS') {
        const d = new Date();
        d.setDate(now.getDate() - 90);
        matchDate = logDate >= d;
      } else if (dateFilterPreset === 'YEAR') {
        matchDate = logDate.getFullYear() === now.getFullYear();
      } else if (dateFilterPreset === 'CUSTOM') {
        if (customStartDate) {
          matchDate = matchDate && logDate >= new Date(customStartDate + 'T00:00:00');
        }
        if (customEndDate) {
          matchDate = matchDate && logDate <= new Date(customEndDate + 'T23:59:59');
        }
      }

      return matchSearch && matchType && matchDate;
    });
  }, [logs, searchTerm, typeFilter, dateFilterPreset, customStartDate, customEndDate]);

  const handleExportExcel = () => {
    const data = filteredLogs.map((l) => ({
      Waktu: new Date(l.createdAt).toLocaleString('id-ID'),
      'Tipe Aksi': l.type,
      'Detail Perubahan': l.details,
      SKU: l.sku || '-',
      'Nama Barang': l.productName || '-',
      Kuantitas: l.quantity || '-',
      'User Pelaksana': l.user,
    }));
    exportToExcel(data, 'PriangLab_AuditLogs');
  };

  const handleExportCSV = () => {
    const data = filteredLogs.map((l) => ({
      Waktu: new Date(l.createdAt).toLocaleString('id-ID'),
      Tipe: l.type,
      Detail: l.details,
      SKU: l.sku || '-',
      Barang: l.productName || '-',
      Kuantitas: l.quantity || '-',
      User: l.user,
    }));
    exportToCSV(data, 'PriangLab_AuditLogs');
  };

  const handleExecuteClearAllData = () => {
    setIsConfirmClearModalOpen(false);
    inventoryStore.clearAllDataToZero(currentUser.name);
    setFeedbackBanner({
      type: 'success',
      message: 'Seluruh data berhasil dikosongkan. Sistem sekarang bersih dan dimulai dari 0.',
    });
  };

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedbackBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            onClick={() => setFeedbackBanner(null)}
            className="text-slate-400 hover:text-slate-700 text-xs font-bold"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Title */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Log Aktivitas &amp; Audit Trail
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-900 text-white">
              {filteredLogs.length} Riwayat
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Rekam jejak kepatuhan audit seluruh pergerakan stok, scan resi packer, dan modifikasi master data.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white rounded-lg transition flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Ekspor Excel</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white rounded-lg transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>CSV</span>
            </button>
          </div>

          <button
            onClick={() => setIsConfirmClearModalOpen(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            title="Kosongkan seluruh data untuk mulai dari 0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
            <span>Mulai dari 0 (Kosongkan Data)</span>
          </button>
        </div>
      </div>

      {/* Filter and Date Presets */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        {/* Search & Action Type */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari berdasarkan kata kunci, SKU, nama barang, nomor resi, atau user..."
              className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          <div className="w-full sm:w-auto">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full text-xs font-semibold py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">Semua Jenis Aksi</option>
              <option value="INBOUND">INBOUND (Barang Masuk)</option>
              <option value="OUTBOUND">OUTBOUND (Barang Keluar)</option>
              <option value="SCAN_PACKER">SCAN_PACKER (Ekspedisi)</option>
              <option value="MASTER_DATA">MASTER_DATA (Katalog SKU)</option>
            </select>
          </div>
        </div>

        {/* Date Filter Quick Presets */}
        <div className="flex items-center gap-2 flex-wrap text-xs font-semibold pt-1">
          <span className="text-slate-400 text-[11px] flex items-center gap-1 shrink-0">
            <Calendar className="w-3.5 h-3.5" /> Filter Waktu:
          </span>
          <button
            onClick={() => setDateFilterPreset('ALL')}
            className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
              dateFilterPreset === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setDateFilterPreset('TODAY')}
            className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
              dateFilterPreset === 'TODAY' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Hari Ini
          </button>
          <button
            onClick={() => setDateFilterPreset('WEEK')}
            className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
              dateFilterPreset === 'WEEK' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            1 Minggu Terakhir
          </button>
          <button
            onClick={() => setDateFilterPreset('MONTH')}
            className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
              dateFilterPreset === 'MONTH' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            1 Bulan Terakhir
          </button>
          <button
            onClick={() => setDateFilterPreset('3_MONTHS')}
            className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
              dateFilterPreset === '3_MONTHS' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            3 Bulan Terakhir
          </button>
          <button
            onClick={() => setDateFilterPreset('YEAR')}
            className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
              dateFilterPreset === 'YEAR' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Tahun Ini
          </button>
          <button
            onClick={() => setDateFilterPreset('CUSTOM')}
            className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
              dateFilterPreset === 'CUSTOM' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Kustom Rentang Tanggal
          </button>
        </div>

        {/* Custom Datepicker */}
        {dateFilterPreset === 'CUSTOM' && (
          <div className="flex items-center gap-3 p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs">
            <span className="font-bold text-blue-900">Dari:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="p-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
            />
            <span className="font-bold text-blue-900">Sampai:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="p-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
            />
          </div>
        )}
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
              <tr>
                <th className="py-3 px-4">Waktu &amp; Tanggal</th>
                <th className="py-3 px-4">Tipe Aksi</th>
                <th className="py-3 px-4">Keterangan / Detail Aktivitas</th>
                <th className="py-3 px-4">SKU Terkait</th>
                <th className="py-3 px-4 text-center">QTY</th>
                <th className="py-3 px-4">User Pelaksana</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">Tidak ada riwayat log ditemukan</p>
                    <p className="text-[11px] mt-1">Coba sesuaikan kata kunci pencarian atau filter tanggal.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('id-ID')}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            log.type === 'INBOUND'
                              ? 'bg-indigo-100 text-indigo-800'
                              : log.type === 'OUTBOUND'
                              ? 'bg-rose-100 text-rose-800'
                              : log.type === 'SCAN_PACKER'
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {log.type === 'INBOUND' && <PackagePlus className="w-3 h-3" />}
                          {log.type === 'OUTBOUND' && <PackageMinus className="w-3 h-3" />}
                          {log.type === 'SCAN_PACKER' && <Barcode className="w-3 h-3" />}
                          {log.type === 'MASTER_DATA' && <Boxes className="w-3 h-3" />}
                          <span>{log.type}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-800 max-w-md">
                        {log.details}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                        {log.sku || '-'}
                      </td>

                      <td className="py-3.5 px-4 text-center font-black text-slate-900">
                        {log.quantity ? log.quantity : '-'}
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {log.user}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* In-App Confirm Clear All Data Modal */}
      {isConfirmClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600/30 border border-rose-500/40 text-rose-400 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Kosongkan Data (Mulai dari 0)</h3>
                  <p className="text-xs text-slate-400">Konfirmasi pembersihan total sistem</p>
                </div>
              </div>
              <button
                onClick={() => setIsConfirmClearModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-1.5 text-slate-800">
                <div className="font-bold text-rose-900">Perhatian:</div>
                <p className="leading-relaxed text-[11px] text-rose-800">
                  Tindakan ini akan mengosongkan seluruh data katalog SKU, transaksi masuk/keluar, dan lembar scan packer dari memori lokal dan cloud database agar Anda dapat memulai sistem dari 0.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsConfirmClearModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteClearAllData}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition shadow-lg shadow-rose-600/30 text-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Ya, Kosongkan Semua</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
