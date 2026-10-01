import React, { useState } from 'react';
import {
  PackagePlus,
  Camera,
  Search,
  CheckCircle2,
  FileText,
  FileSpreadsheet,
  Download,
  AlertCircle,
  Boxes,
  MapPin,
  Clock,
} from 'lucide-react';
import { Product, InboundTransaction } from '../types';
import { useAuth } from '../context/AuthContext';
import { inventoryStore } from '../lib/inventoryStore';
import { exportToExcel, exportToCSV } from '../utils/export';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { beeper } from '../utils/audio';

interface InboundViewProps {
  products: Product[];
  inboundRecords: InboundTransaction[];
}

export const InboundView: React.FC<InboundViewProps> = ({ products, inboundRecords }) => {
  const { currentUser } = useAuth();

  const [poNumber, setPoNumber] = useState('');
  const [skuQuery, setSkuQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(10);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Scanner modal
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Search product as user types SKU/Barcode
  const handleSkuSearch = (query: string) => {
    setSkuQuery(query);
    const found = inventoryStore.findProductByCode(query);
    setSelectedProduct(found || null);
  };

  const handleBarcodeScanned = (code: string) => {
    setSkuQuery(code);
    const found = inventoryStore.findProductByCode(code);
    if (found) {
      setSelectedProduct(found);
      beeper.playSuccess();
      setFeedback({ type: 'success', message: `Barang teridentifikasi: ${found.name} (${found.sku})` });
    } else {
      setSelectedProduct(null);
      beeper.playError();
      setFeedback({ type: 'error', message: `Barcode/SKU "${code}" tidak ditemukan dalam Master Data.` });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProduct) {
      setFeedback({
        type: 'error',
        message: 'Pilih barang terlebih dahulu melalui pencarian SKU atau Barcode.',
      });
      return;
    }

    if (quantity <= 0) {
      setFeedback({
        type: 'error',
        message: 'Kuantitas masuk harus lebih dari 0.',
      });
      return;
    }

    setIsSubmitting(true);
    const res = await inventoryStore.addInbound(
      selectedProduct.sku,
      quantity,
      poNumber,
      notes,
      currentUser.name
    );
    setIsSubmitting(false);

    if (res.success) {
      beeper.playSuccess();
      setFeedback({ type: 'success', message: res.message });
      // Reset form fields
      setQuantity(10);
      setNotes('');
      setSkuQuery('');
      setSelectedProduct(null);
    } else {
      beeper.playError();
      setFeedback({ type: 'error', message: res.message });
    }
  };

  const handleExportExcel = () => {
    const data = inboundRecords.map((r) => ({
      'No. PO / Surat Jalan': r.poNumber,
      SKU: r.sku,
      'Nama Barang': r.productName,
      'Kuantitas Masuk': r.quantity,
      Catatan: r.notes || '-',
      'Diterima Oleh': r.createdBy,
      Waktu: new Date(r.createdAt).toLocaleString('id-ID'),
    }));
    exportToExcel(data, 'PriangLab_Inbound');
  };

  const handleExportCSV = () => {
    const data = inboundRecords.map((r) => ({
      'No. PO': r.poNumber,
      SKU: r.sku,
      'Nama Barang': r.productName,
      Kuantitas: r.quantity,
      Catatan: r.notes || '-',
      Petugas: r.createdBy,
      Waktu: new Date(r.createdAt).toLocaleString('id-ID'),
    }));
    exportToCSV(data, 'PriangLab_Inbound');
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Inbound &amp; Penerimaan Barang Masuk
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-800">
              Penerimaan Stok
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Input barang masuk dari supplier, vendor, atau hasil konveksi untuk penambahan stok fisik gudang.
          </p>
        </div>

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
      </div>

      {/* Main Grid: Form Entry + Item Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form: Inbound Entry */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Form Penerimaan Barang
            </h2>
            <span className="text-xs text-slate-500">
              Petugas: <strong className="text-slate-800">{currentUser.name}</strong>
            </span>
          </div>

          {feedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* PO / Surat Jalan */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Nomor PO / Surat Jalan (Opsional)
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="misal: PO-202610-001 / SJ-BDG-99"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>
            </div>

            {/* SKU Search & Barcode Scan */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Cari Kode SKU / Scan Barcode Produk <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={skuQuery}
                    onChange={(e) => handleSkuSearch(e.target.value)}
                    placeholder="Ketik SKU misal: (A)-A01-1 atau nomor barcode..."
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-500 font-mono text-xs font-semibold"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer shrink-0"
                >
                  <Camera className="w-4 h-4 text-indigo-400" />
                  <span>Scan Kamera</span>
                </button>
              </div>

              {/* Quick SKU suggestions if query typed */}
              {skuQuery.length > 0 && !selectedProduct && (
                <div className="mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl max-h-40 overflow-y-auto space-y-1">
                  {products
                    .filter(
                      (p) =>
                        p.sku.toLowerCase().includes(skuQuery.toLowerCase()) ||
                        p.name.toLowerCase().includes(skuQuery.toLowerCase())
                    )
                    .slice(0, 4)
                    .map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedProduct(p);
                          setSkuQuery(p.sku);
                        }}
                        className="p-2 hover:bg-indigo-50 rounded-lg cursor-pointer flex justify-between items-center transition"
                      >
                        <div>
                          <span className="font-mono font-bold text-slate-900">{p.sku}</span> -{' '}
                          <span className="text-slate-600">{p.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold">Stok: {p.availableStock} {p.unit}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Selected Product Card Banner */}
            {selectedProduct && (
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-indigo-900 text-sm">
                      {selectedProduct.sku}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-800 text-xs mt-0.5">
                    {selectedProduct.name}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Rak: <strong>{selectedProduct.binLocation}</strong></span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Stok Saat Ini</div>
                  <div className="text-lg font-black text-slate-900">
                    {selectedProduct.availableStock} {selectedProduct.unit}
                  </div>
                </div>
              </div>
            )}

            {/* Quantity and Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Kuantitas Masuk <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-500 font-black text-base"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan Penerimaan</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Keterangan batch, kondisi fisik, dsb."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!selectedProduct || isSubmitting}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-xl transition shadow-md shadow-indigo-600/20 text-xs cursor-pointer flex items-center justify-center gap-2"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Simpan Penerimaan Stok</span>
            </button>
          </form>
        </div>

        {/* Right Info: Recent Inbounds Mini List */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Riwayat Inbound Terakhir
            </h3>
            <span className="text-[11px] text-slate-400">{inboundRecords.length} Transaksi</span>
          </div>

          <div className="space-y-2.5 max-h-[360px] overflow-y-auto">
            {inboundRecords.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Belum ada transaksi barang masuk tersimpan.
              </div>
            ) : (
              inboundRecords.slice(0, 6).map((rec) => (
                <div
                  key={rec.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1"
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono font-bold text-slate-900">{rec.sku}</span>
                    <span className="font-bold text-indigo-600">+{rec.quantity} Pcs</span>
                  </div>
                  <div className="text-[11px] text-slate-600 truncate">{rec.productName}</div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                    <span>PO: {rec.poNumber}</span>
                    <span>
                      {new Date(rec.createdAt).toLocaleTimeString('id-ID', {
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

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="Scan Barcode Inbound"
        subtitle="Arahkan kamera ke barcode SKU atau label PO"
      />
    </div>
  );
};
