import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Barcode,
  Lock,
  Unlock,
  CheckCircle2,
  PackageCheck,
  Truck,
  Plus,
  Camera,
  Search,
  FileSpreadsheet,
  Download,
  AlertCircle,
  Clock,
  Calendar,
  X,
  Check,
  Filter,
  FilePlus,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import { Product, PackerSession, PackerResiItem, DateFilterPreset } from '../types';
import { useAuth } from '../context/AuthContext';
import { inventoryStore } from '../lib/inventoryStore';
import { exportPackerExcel, exportToCSV } from '../utils/export';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { beeper } from '../utils/audio';

interface PackerViewProps {
  products: Product[];
  session: PackerSession;
  resiItems: PackerResiItem[];
}

export const PackerView: React.FC<PackerViewProps> = ({ products, session, resiItems }) => {
  const { currentUser } = useAuth();

  // Tab View
  const [activeSubTab, setActiveSubTab] = useState<'SHEET' | 'HISTORY'>('SHEET');

  // Batch Session Modal
  const [isNewBatchModalOpen, setIsNewBatchModalOpen] = useState(false);
  const [newBatchTitleInput, setNewBatchTitleInput] = useState('');

  // Step 1: Resi Locking
  const [resiNumberInput, setResiNumberInput] = useState('');
  const [lockedResi, setLockedResi] = useState<string | null>(null);
  const [lockedCourier, setLockedCourier] = useState<string>('');

  // Step 2: SKU scan
  const [skuInput, setSkuInput] = useState('');
  const [skuQtyInput, setSkuQtyInput] = useState<number>(1);

  // Step 3: Scan Out Single
  const [scanOutResiInput, setScanOutResiInput] = useState('');

  // Confirmation Modal for Finishing 1 Resi ("Konfirmasi tidak ada barang lagi dan lanjut")
  const [isConfirmFinishResiModalOpen, setIsConfirmFinishResiModalOpen] = useState(false);

  // Confirmation Modal for Scan Out All Resi (fixes window.confirm being blocked in iframe)
  const [isConfirmScanOutAllModalOpen, setIsConfirmScanOutAllModalOpen] = useState(false);

  // Camera Scanner Modal
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'LOCK_RESI' | 'SCAN_SKU' | 'SCAN_OUT'>('LOCK_RESI');

  // Banner notification
  const [banner, setBanner] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    details?: string;
  } | null>(null);

  // Refs for auto-focus
  const resiInputRef = useRef<HTMLInputElement | null>(null);
  const skuInputRef = useRef<HTMLInputElement | null>(null);
  const scanOutInputRef = useRef<HTMLInputElement | null>(null);

  // Auto focus logic
  useEffect(() => {
    if (activeSubTab === 'SHEET') {
      if (!lockedResi) {
        resiInputRef.current?.focus();
      } else {
        skuInputRef.current?.focus();
      }
    }
  }, [lockedResi, activeSubTab]);

  // Lock Resi Handler
  const handleLockResi = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = resiNumberInput.trim().toUpperCase();
    if (!clean) {
      setBanner({
        type: 'error',
        message: 'Nomor Resi Belum Diisi',
        details: 'Silakan masukkan atau scan nomor barcode resi paket terlebih dahulu.',
      });
      return;
    }

    setLockedResi(clean);

    let detected = 'Shopee Xpress';
    if (clean.startsWith('JX') || clean.startsWith('JP') || clean.startsWith('JT')) detected = 'J&T Express';
    else if (clean.startsWith('01') || clean.startsWith('JNE') || /^\d{12}$/.test(clean)) detected = 'JNE Express';
    else if (clean.startsWith('TKP') || clean.startsWith('TLX')) detected = 'SiCepat';
    else if (clean.startsWith('ANTR')) detected = 'Anteraja';
    else if (clean.startsWith('LX') || clean.startsWith('NLID')) detected = 'Ninja / Lazada';
    setLockedCourier(detected);

    beeper.playLock();
    setBanner({
      type: 'info',
      message: `Resi ${clean} (${detected}) BERHASIL TERKUNCI!`,
      details: 'Silakan scan barcode barang yang masuk ke dalam paket ini.',
    });

    setResiNumberInput('');
  };

  // Add SKU to current locked resi
  const handleAddSkuToResi = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!lockedResi) {
      setBanner({
        type: 'error',
        message: 'Resi Belum Terkunci',
        details: 'Kunci nomor resi terlebih dahulu sebelum scan barcode barang.',
      });
      return;
    }
    const cleanCode = skuInput.trim();
    if (!cleanCode) return;

    // Strict validation: check product exists in catalog
    const product = inventoryStore.findProductByCode(cleanCode);
    if (!product) {
      beeper.playError();
      setBanner({
        type: 'error',
        message: 'Barcode Tidak Dikenali!',
        details: `Kode "${cleanCode}" tidak ada di Master Data. Pastikan barang sudah didaftarkan.`,
      });
      setSkuInput('');
      skuInputRef.current?.focus();
      return;
    }

    const res = await inventoryStore.addPackerItem(
      lockedResi,
      cleanCode,
      skuQtyInput,
      lockedCourier,
      currentUser.name
    );

    if (res.success) {
      beeper.playSuccess();
      setBanner({
        type: 'success',
        message: `+${skuQtyInput} pcs ${res.item?.sku} Masuk ke Resi ${lockedResi}`,
        details: `${res.item?.productName} — Stok katalog berhasil dipotong otomatis.`,
      });
      setSkuInput('');
      setSkuQtyInput(1);
    } else {
      beeper.playError();
      setBanner({
        type: 'error',
        message: 'Gagal Scan Barang!',
        details: res.message,
      });
    }

    skuInputRef.current?.focus();
  };

  // Items currently inside the active locked resi
  const currentLockedItems = useMemo(() => {
    if (!lockedResi) return [];
    return resiItems.filter(
      (i) => i.resiNumber.toUpperCase() === lockedResi.toUpperCase()
    );
  }, [resiItems, lockedResi]);

  // Click "Selesai Scan 1 Resi & Konfirmasi Lanjut"
  const handleOpenConfirmFinish = () => {
    if (!lockedResi) return;
    if (currentLockedItems.length === 0) {
      setLockedResi(null);
      setLockedCourier('');
      setBanner({
        type: 'info',
        message: 'Kunci Resi Dibatalkan',
        details: 'Tidak ada barang yang di-scan pada resi ini.',
      });
      return;
    }
    setIsConfirmFinishResiModalOpen(true);
  };

  // User confirms modal: no more items for this resi, proceed to next resi
  const handleConfirmFinishAndNext = () => {
    beeper.playSuccess();
    const finishedResi = lockedResi;
    setIsConfirmFinishResiModalOpen(false);
    setLockedResi(null);
    setLockedCourier('');
    setSkuInput('');

    setBanner({
      type: 'success',
      message: `Resi ${finishedResi} Selesai Dikonfirmasi!`,
      details: 'Paket siap di-packing dan sistem siap menerima scan nomor resi berikutnya.',
    });

    setTimeout(() => {
      resiInputRef.current?.focus();
    }, 100);
  };

  // Scan Out Single Resi
  const handleScanOutSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = scanOutResiInput.trim();
    if (!clean) return;

    const res = await inventoryStore.scanOutResi(clean, currentUser.name);
    if (res.success) {
      beeper.playScanOut();
      setBanner({
        type: 'success',
        message: 'Resi Berhasil Di-Scan Out!',
        details: res.message,
      });
      setScanOutResiInput('');
    } else {
      beeper.playError();
      setBanner({
        type: 'error',
        message: 'Scan Out Gagal',
        details: res.message,
      });
    }
  };

  // Scan Out All Resi (Batch handover to courier)
  const handleScanOutAllClick = () => {
    const uncompleted = resiItems.filter((i) => !i.isScannedOut);
    if (uncompleted.length === 0) {
      setBanner({
        type: 'info',
        message: 'Informasi Scan Out',
        details: 'Semua resi pada lembar scan ini sudah selesai di-Scan Out.',
      });
      return;
    }
    setIsConfirmScanOutAllModalOpen(true);
  };

  const handleExecuteScanOutAll = async () => {
    setIsConfirmScanOutAllModalOpen(false);
    const res = await inventoryStore.scanOutAll(currentUser.name);
    if (res.success) {
      beeper.playScanOut();
      setBanner({
        type: 'success',
        message: 'Scan Out Massal Sukses!',
        details: res.message,
      });
    } else {
      setBanner({
        type: 'info',
        message: 'Informasi Scan Out',
        details: res.message,
      });
    }
  };

  // Create New Batch Sheet
  const handleCreateNewBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newBatchTitleInput.trim();
    if (!title) {
      setBanner({
        type: 'error',
        message: 'Judul Batch Kosong',
        details: 'Mohon masukkan nama atau judul lembar sheet packer baru.',
      });
      return;
    }

    await inventoryStore.createNewBatchSession(title, currentUser.name);
    setIsNewBatchModalOpen(false);
    setLockedResi(null);
    setLockedCourier('');
    beeper.playSuccess();
    setBanner({
      type: 'success',
      message: `Lembar Sheet Baru Berhasil Dibuat: "${title}"`,
      details: 'Semua device terhubung telah tersinkronisasi ke judul sheet baru ini.',
    });
  };

  // Camera Scanner Result handler
  const handleCameraScanResult = (code: string) => {
    const clean = code.trim().toUpperCase();

    if (scannerMode === 'LOCK_RESI') {
      setLockedResi(clean);
      setLockedCourier('Ekspedisi Auto');
      beeper.playLock();
      setBanner({
        type: 'info',
        message: `Resi ${clean} BERHASIL TERKUNCI via Kamera!`,
        details: 'Silakan scan barcode barang SKU produk.',
      });
    } else if (scannerMode === 'SCAN_SKU') {
      if (lockedResi) {
        inventoryStore.addPackerItem(
          lockedResi,
          code,
          skuQtyInput,
          lockedCourier,
          currentUser.name
        ).then((res) => {
          if (res.success) {
            beeper.playSuccess();
            setBanner({
              type: 'success',
              message: `+${skuQtyInput} pcs SKU ${res.item?.sku} Masuk ke Resi ${lockedResi}`,
              details: res.message,
            });
            setSkuInput('');
          } else {
            beeper.playError();
            setBanner({
              type: 'error',
              message: 'Scan SKU Gagal!',
              details: res.message,
            });
          }
        });
      }
    } else if (scannerMode === 'SCAN_OUT') {
      inventoryStore.scanOutResi(code, currentUser.name).then((res) => {
        if (res.success) {
          beeper.playScanOut();
          setBanner({
            type: 'success',
            message: 'Scan Out Selesai!',
            details: res.message,
          });
        } else {
          beeper.playError();
          setBanner({
            type: 'error',
            message: 'Gagal Scan Out',
            details: res.message,
          });
        }
      });
    }
  };

  // TAB 2: History Filter States
  const [historySearch, setHistorySearch] = useState('');
  const [dateFilterPreset, setDateFilterPreset] = useState<DateFilterPreset>('TODAY');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'SCANNED_OUT'>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const filteredHistory = useMemo(() => {
    return resiItems.filter((item) => {
      const search = historySearch.toLowerCase();
      const matchSearch =
        item.resiNumber.toLowerCase().includes(search) ||
        item.sku.toLowerCase().includes(search) ||
        item.productName.toLowerCase().includes(search) ||
        (item.sheetTitle && item.sheetTitle.toLowerCase().includes(search));

      let matchStatus = true;
      if (statusFilter === 'PENDING') matchStatus = !item.isScannedOut;
      else if (statusFilter === 'SCANNED_OUT') matchStatus = item.isScannedOut;

      const itemDate = new Date(item.createdAt);
      const now = new Date();
      let matchDate = true;

      if (dateFilterPreset === 'TODAY') {
        matchDate = itemDate.toDateString() === now.toDateString();
      } else if (dateFilterPreset === 'WEEK') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        matchDate = itemDate >= sevenDaysAgo;
      } else if (dateFilterPreset === 'MONTH') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        matchDate = itemDate >= thirtyDaysAgo;
      } else if (dateFilterPreset === 'YEAR') {
        matchDate = itemDate.getFullYear() === now.getFullYear();
      } else if (dateFilterPreset === 'CUSTOM') {
        if (customStartDate) {
          matchDate = matchDate && itemDate >= new Date(customStartDate + 'T00:00:00');
        }
        if (customEndDate) {
          matchDate = matchDate && itemDate <= new Date(customEndDate + 'T23:59:59');
        }
      }

      return matchSearch && matchStatus && matchDate;
    });
  }, [resiItems, historySearch, statusFilter, dateFilterPreset, customStartDate, customEndDate]);

  return (
    <div className="space-y-6">
      {/* 1. JUDUL SHEET PACKER: Slate-900 High Contrast Enterprise Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] uppercase tracking-widest font-black text-blue-400">
                MEJA PACKING &amp; SCAN EKSPEDISI AKTIF
              </span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-slate-800 text-slate-300 border border-slate-700">
                Operator: {currentUser.name}
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {session.batchTitle}
              </h1>
              <button
                onClick={() => {
                  const now = new Date();
                  const pad = (n: number) => n.toString().padStart(2, '0');
                  setNewBatchTitleInput(`Sheet Packer ${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`);
                  setIsNewBatchModalOpen(true);
                }}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-sm"
              >
                <FilePlus className="w-3.5 h-3.5" />
                <span>+ Buat Batch Baru</span>
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Sistem potong stok otomatis real-time dengan sinkronisasi ke seluruh perangkat.
            </p>
          </div>

          {/* Direct Live Summary Indicators */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 text-center">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Total Resi</div>
              <div className="text-xl sm:text-2xl font-black text-white mt-0.5">{session.totalResi}</div>
              <div className="text-[9px] text-slate-500">Resi Unik</div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 text-center">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Total QTY</div>
              <div className="text-xl sm:text-2xl font-black text-blue-400 mt-0.5">{session.totalQty}</div>
              <div className="text-[9px] text-slate-500">Pcs Fisik Terpotong</div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 text-center">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Scan Out</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">{session.scannedOutCount}</div>
              <div className="text-[9px] text-slate-500">Selesai / Kurir</div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 text-center">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Pending</div>
              <div className="text-xl sm:text-2xl font-black text-amber-400 mt-0.5">
                {Math.max(0, session.totalResi - session.scannedOutCount)}
              </div>
              <div className="text-[9px] text-slate-500">Belum Scan Out</div>
            </div>
          </div>
        </div>

        {/* Action Tabs & Scan Out Semua Button */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2.5 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab('SHEET')}
              className={`px-3.5 py-2 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'SHEET'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Barcode className="w-4 h-4" />
              <span>Tab 1: Lembar Scan Aktif</span>
            </button>
            <button
              onClick={() => setActiveSubTab('HISTORY')}
              className={`px-3.5 py-2 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'HISTORY'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Tab 2: Riwayat Scan ({resiItems.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Scan Out Semua Resi Button */}
            <button
              onClick={handleScanOutAllClick}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <Truck className="w-4 h-4" />
              <span>Scan Out Semua Resi (Serah Terima Kurir)</span>
            </button>

            {/* Direct Export matching Image 1 */}
            <button
              onClick={() => exportPackerExcel(resiItems, session.batchTitle, currentUser.name)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
              title="Unduh format Excel persis seperti laporan gudang resmi"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Download Excel Scan Packer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Feedback Notification Banner */}
      {banner && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-start justify-between gap-3 animate-in fade-in ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : banner.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-blue-50 border-blue-300 text-blue-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : banner.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <Lock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold text-sm">{banner.message}</div>
              {banner.details && <div className="text-slate-600 mt-0.5">{banner.details}</div>}
            </div>
          </div>
          <button
            onClick={() => setBanner(null)}
            className="text-slate-400 hover:text-slate-700 text-xs font-bold"
          >
            Tutup
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: LEMBAR KERJA SCAN PACKER AKTIF */}
      {/* ======================================================== */}
      {activeSubTab === 'SHEET' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Meja Packing Left Column (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Kunci Resi Box */}
            <div
              className={`rounded-2xl border p-5 transition shadow-xs ${
                lockedResi
                  ? 'bg-emerald-50/60 border-emerald-300'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 mb-4">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      lockedResi ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
                    }`}
                  >
                    1
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      {lockedResi ? 'Resi Ekspedisi Terkunci' : 'Kunci Nomor Resi Ekspedisi'}
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Scan barcode nomor resi paket (SPX, J&amp;T, JNE, SiCepat, dll.)
                    </p>
                  </div>
                </div>

                {lockedResi && (
                  <button
                    onClick={handleOpenConfirmFinish}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Konfirmasi Resi Selesai &amp; Lanjut</span>
                  </button>
                )}
              </div>

              {lockedResi ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-emerald-200 shadow-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-600" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                        Status Kunci: AKTIF
                      </span>
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                        {lockedCourier}
                      </span>
                    </div>
                    <div className="font-mono text-xl font-black text-slate-900 tracking-wider">
                      {lockedResi}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Operator dapat scan 1 atau lebih barang berbeda ke dalam resi ini.
                    </p>
                  </div>

                  <div className="text-right border-t sm:border-t-0 sm:border-l sm:pl-4 border-slate-100">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Item di Resi Ini</div>
                    <div className="text-2xl font-black text-emerald-600">
                      {currentLockedItems.reduce((acc, i) => acc + i.quantity, 0)} Pcs
                    </div>
                    <div className="text-[10px] text-slate-500">{currentLockedItems.length} SKU ter-scan</div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleLockResi} className="flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={resiInputRef}
                      type="text"
                      value={resiNumberInput}
                      onChange={(e) => setResiNumberInput(e.target.value)}
                      placeholder="Scan Barcode No. Resi (SPX / JX / JNE / SiCepat)..."
                      className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20 cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Kunci Resi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScannerMode('LOCK_RESI');
                      setIsScannerOpen(true);
                    }}
                    className="px-3.5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
                    title="Scan Barcode via Kamera HP"
                  >
                    <Camera className="w-4 h-4 text-blue-400" />
                  </button>
                </form>
              )}
            </div>

            {/* Step 2: Multi-SKU Item Scan Bar (Active when resi locked) */}
            <div
              className={`rounded-2xl border p-5 transition shadow-xs ${
                lockedResi
                  ? 'bg-white border-blue-400 ring-2 ring-blue-500/10'
                  : 'bg-slate-50 border-slate-200 opacity-60 pointer-events-none'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Scan Barcode Barang ke Resi Terkunci (Multi-SKU)
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Scan barcode produk. Stok fisik Master Data langsung dipotong secara akurat.
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
                  Target: {lockedResi || 'Resi Belum Dikunci'}
                </span>
              </div>

              <form onSubmit={handleAddSkuToResi} className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={skuInputRef}
                      type="text"
                      disabled={!lockedResi}
                      value={skuInput}
                      onChange={(e) => setSkuInput(e.target.value)}
                      placeholder="Scan Barcode SKU Produk atau ketik kode..."
                      className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  <div className="w-24">
                    <input
                      type="number"
                      min={1}
                      disabled={!lockedResi}
                      value={skuQtyInput}
                      onChange={(e) => setSkuQtyInput(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full py-3 px-2 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-black text-sm focus:outline-none focus:border-blue-500"
                      title="Jumlah Barang per Scan"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!lockedResi || !skuInput.trim()}
                    className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20 cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Masuk</span>
                  </button>

                  <button
                    type="button"
                    disabled={!lockedResi}
                    onClick={() => {
                      setScannerMode('SCAN_SKU');
                      setIsScannerOpen(true);
                    }}
                    className="px-3.5 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
                    title="Scan SKU via Kamera HP"
                  >
                    <Camera className="w-4 h-4 text-blue-400" />
                  </button>
                </div>
              </form>

              {/* Items in Active Locked Resi */}
              {lockedResi && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                    <span>Barang di Resi Ini ({currentLockedItems.length} SKU):</span>
                    <button
                      onClick={handleOpenConfirmFinish}
                      className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer font-bold"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Selesai &amp; Konfirmasi Resi Lanjut &rarr;</span>
                    </button>
                  </div>

                  {currentLockedItems.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      Belum ada barang di-scan untuk resi ini. Arahkan scanner ke produk.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {currentLockedItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                        >
                          <div>
                            <div className="font-mono font-bold text-slate-900">{item.sku}</div>
                            <div className="text-slate-600 font-medium">{item.productName}</div>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-sm text-blue-600">
                              {item.quantity} Pcs
                            </span>
                            <div className="text-[10px] text-slate-400">
                              {new Date(item.createdAt).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 3: Scan Out Resi Satuan */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Scan Out Resi (Penyelesaian Paket Satuan)
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Scan barcode resi yang sudah terbungkus untuk menandai status selesai kirim ke kurir.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleScanOutAllClick}
                  className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                >
                  Scan Out Semua Sekaligus
                </button>
              </div>

              <form onSubmit={handleScanOutSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <Truck className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={scanOutInputRef}
                    type="text"
                    value={scanOutResiInput}
                    onChange={(e) => setScanOutResiInput(e.target.value)}
                    placeholder="Scan Barcode No. Resi Siap Kirim..."
                    className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold text-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>Scan Out Selesai</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScannerMode('SCAN_OUT');
                    setIsScannerOpen(true);
                  }}
                  className="px-3.5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
                  title="Scan Out via Kamera HP"
                >
                  <Camera className="w-4 h-4 text-emerald-400" />
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Antrean Resi Dalam Batch */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Antrean Resi Dalam Batch
                </h3>
                <p className="text-[11px] text-slate-500">Live monitoring meja packing</p>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800">
                {resiItems.length} Item
              </span>
            </div>

            <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
              {resiItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Belum ada paket yang di-scan pada batch ini. Mulai dengan mengunci nomor resi di sebelah kiri.
                </div>
              ) : (
                resiItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border text-xs space-y-1.5 transition ${
                      item.isScannedOut
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-slate-900">{item.resiNumber}</span>
                      {item.isScannedOut ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <Check className="w-3 h-3" /> Diserahkan
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3" /> Pending Scan Out
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-slate-600">
                      <span className="font-medium truncate max-w-[170px]">{item.productName}</span>
                      <span className="font-bold text-slate-900 shrink-0">
                        {item.sku} &times; {item.quantity}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>{item.courier}</span>
                      <span>
                        {new Date(item.createdAt).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: RIWAYAT SCAN RESI & BARANG GUDANG */}
      {/* ======================================================== */}
      {activeSubTab === 'HISTORY' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            {/* Search & Export */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Cari No. Resi, SKU, Nama Barang, Judul Sheet..."
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => exportPackerExcel(filteredHistory, session.batchTitle, currentUser.name)}
                  className="px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-300 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Download Excel Sesuai Format</span>
                </button>
              </div>
            </div>

            {/* Date Presets */}
            <div className="flex items-center gap-2 flex-wrap text-xs font-semibold pt-1">
              <span className="text-slate-400 text-[11px] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Rentang Waktu:
              </span>
              <button
                onClick={() => setDateFilterPreset('TODAY')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  dateFilterPreset === 'TODAY' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Hari Ini
              </button>
              <button
                onClick={() => setDateFilterPreset('WEEK')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  dateFilterPreset === 'WEEK' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Minggu Ini (7 Hari)
              </button>
              <button
                onClick={() => setDateFilterPreset('MONTH')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  dateFilterPreset === 'MONTH' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Bulan Ini (30 Hari)
              </button>
              <button
                onClick={() => setDateFilterPreset('YEAR')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  dateFilterPreset === 'YEAR' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Tahun Ini
              </button>
              <button
                onClick={() => setDateFilterPreset('ALL')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  dateFilterPreset === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Semua Periode
              </button>
              <button
                onClick={() => setDateFilterPreset('CUSTOM')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  dateFilterPreset === 'CUSTOM' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Kustom Rentang Tanggal
              </button>
            </div>

            {/* Custom Date Range */}
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

            {/* Status Filter */}
            <div className="flex items-center gap-2 pt-1 text-xs font-semibold">
              <span className="text-slate-400 text-[11px] flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Status Resi:
              </span>
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  statusFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  statusFilter === 'PENDING' ? 'bg-amber-600 text-white' : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                Belum Scan Out (Pending)
              </button>
              <button
                onClick={() => setStatusFilter('SCANNED_OUT')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  statusFilter === 'SCANNED_OUT' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                Sudah Scan Out (Selesai)
              </button>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4">No. Resi</th>
                    <th className="py-3 px-4">Judul Sheet</th>
                    <th className="py-3 px-4">Barcode SKU</th>
                    <th className="py-3 px-4">Nama Produk</th>
                    <th className="py-3 px-4 text-center">QTY</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Waktu Scan In</th>
                    <th className="py-3 px-4">Waktu Scan Out</th>
                    <th className="py-3 px-4">Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        Tidak ada riwayat scan ditemukan pada filter ini.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {item.resiNumber}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {item.sheetTitle || session.batchTitle}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                          {item.sku}
                        </td>
                        <td className="py-3.5 px-4 text-slate-800 max-w-xs truncate font-medium">
                          {item.productName}
                        </td>
                        <td className="py-3.5 px-4 text-center font-black text-slate-900">
                          {item.quantity}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {item.isScannedOut ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" /> SELESAI (SCAN OUT)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              <Clock className="w-3 h-3" /> MENUNGGU SCAN OUT
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                          {new Date(item.createdAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                          {item.scannedOutAt
                            ? new Date(item.scannedOutAt).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })
                            : '-'}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {item.scannedBy}
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

      {/* MODAL 1: Konfirmasi Resi Selesai (Tidak ada barang lagi di-scan, lanjut ke resi berikutnya) */}
      {isConfirmFinishResiModalOpen && lockedResi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Konfirmasi Selesai Resi</h3>
                  <p className="text-xs text-slate-300">Pastikan semua isi paket sudah lengkap</p>
                </div>
              </div>
              <button
                onClick={() => setIsConfirmFinishResiModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1 text-center">
                <div className="text-[11px] text-slate-400 font-semibold uppercase">Nomor Resi Paket</div>
                <div className="font-mono text-xl font-black text-slate-900 tracking-wider">
                  {lockedResi}
                </div>
                <div className="text-xs text-blue-600 font-bold">{lockedCourier}</div>
              </div>

              <div>
                <div className="font-bold text-slate-800 mb-2 flex justify-between items-center">
                  <span>Daftar Barang yang Telah Di-scan:</span>
                  <span className="text-blue-600 font-black">
                    Total {currentLockedItems.reduce((acc, i) => acc + i.quantity, 0)} Pcs
                  </span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {currentLockedItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center"
                    >
                      <div>
                        <span className="font-mono font-bold text-slate-900">{item.sku}</span>
                        <div className="text-[11px] text-slate-600 truncate max-w-[200px]">
                          {item.productName}
                        </div>
                      </div>
                      <span className="font-black text-slate-900 text-sm">
                        {item.quantity} pcs
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  Tidak ada barang lagi yang akan di-scan ke resi ini? Klik tombol konfirmasi di bawah untuk melanjutkan ke resi berikutnya.
                </span>
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsConfirmFinishResiModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-xs cursor-pointer"
                >
                  Kembali Scan Tambahan
                </button>
                <button
                  type="button"
                  onClick={handleConfirmFinishAndNext}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition shadow-lg shadow-emerald-600/30 text-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Selesai &amp; Lanjut Resi Baru</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Buat Batch Sheet Baru */}
      {isNewBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FilePlus className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">Buat Lembar Batch Sheet Baru</h3>
              </div>
              <button
                onClick={() => setIsNewBatchModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewBatch} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Nama / Judul Sheet Packer Baru <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newBatchTitleInput}
                  onChange={(e) => setNewBatchTitleInput(e.target.value)}
                  placeholder="misal: Sheet Packer 1-10-2026"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-blue-500 text-sm"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Format rekomendasi: Sheet Packer [Tanggal-Bulan-Tahun]
                </p>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-[11px]">
                Sesi baru akan langsung tersinkronisasi ke seluruh device operator gudang secara real-time.
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewBatchModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition shadow-md shadow-blue-600/30"
                >
                  Buat &amp; Buka Sheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleCameraScanResult}
        title={
          scannerMode === 'LOCK_RESI'
            ? 'Scan Barcode Nomor Resi'
            : scannerMode === 'SCAN_SKU'
            ? `Scan SKU ke Resi ${lockedResi}`
            : 'Scan Out Resi Ekspedisi'
        }
        subtitle="Arahkan kamera HP ke barcode resi atau produk"
      />

      {/* MODAL 3: Konfirmasi Scan Out Semua Resi (In-App safe confirmation) */}
      {isConfirmScanOutAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Scan Out Semua Resi</h3>
                  <p className="text-xs text-slate-300">Serah terima ekspedisi massal</p>
                </div>
              </div>
              <button
                onClick={() => setIsConfirmScanOutAllModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1 text-center">
                <div className="text-[11px] text-emerald-800 font-semibold uppercase">Sheet Aktif</div>
                <div className="font-mono text-lg font-black text-slate-900">
                  {session.batchTitle}
                </div>
                <div className="text-xs text-emerald-700 font-bold">
                  {resiItems.filter((i) => !i.isScannedOut).length} item resi belum di-scan out
                </div>
              </div>

              <p className="text-slate-600 text-xs leading-relaxed">
                Tindakan ini akan menandai <strong>SEMUA</strong> resi pada lembar packing ini sebagai <strong>SELESAI (SCAN OUT)</strong> dan mencatat waktu serah terima kurir secara otomatis.
              </p>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsConfirmScanOutAllModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteScanOutAll}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition shadow-lg shadow-emerald-600/30 text-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>Ya, Scan Out Semua</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
