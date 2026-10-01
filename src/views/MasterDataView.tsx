import React, { useState, useMemo } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  FileSpreadsheet,
  Download,
  Edit2,
  Trash2,
  Camera,
  Barcode as BarcodeIcon,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  Printer,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';
import { Product, StockFilter, ProductSortOption } from '../types';
import { useAuth } from '../context/AuthContext';
import { inventoryStore } from '../lib/inventoryStore';
import { exportMasterDataExcel, exportMasterDataCSV } from '../utils/export';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';

interface MasterDataViewProps {
  products: Product[];
}

export const MasterDataView: React.FC<MasterDataViewProps> = ({ products }) => {
  const { currentUser } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('ALL');
  const [sortOption, setSortOption] = useState<ProductSortOption>('SKU_ASC');

  // Modal states
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Barcode scanner modal
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'SEARCH' | 'FORM_BARCODE'>('SEARCH');

  // Barcode Label Print Modal
  const [labelProduct, setLabelProduct] = useState<Product | null>(null);

  // Delete Confirmation Modal (fixes window.confirm being blocked in iframe)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Syncing seed state
  const [isSyncingSeed, setIsSyncingSeed] = useState(false);

  // In-app Notification Banner
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSyncOfficialCatalog = async () => {
    setIsSyncingSeed(true);
    try {
      await inventoryStore.seedFirestoreProducts();
      setFeedbackBanner({
        type: 'success',
        message: '83 Master Data Barang Resmi berhasil dimuat & disinkronkan ke Cloud Firestore!',
      });
    } catch (e) {
      console.error('Sync seed error:', e);
      setFeedbackBanner({
        type: 'error',
        message: 'Gagal menyinkronkan 83 data barang resmi.',
      });
    } finally {
      setIsSyncingSeed(false);
    }
  };

  // Form states (No category)
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    barcode: '',
    binLocation: 'Rak A-01-B1',
    unit: 'Pcs',
    availableStock: 10,
    minStock: 5,
  });

  // Filter & Sort products
  const filteredProducts = useMemo(() => {
    const list = products.filter((p) => {
      const search = searchTerm.toLowerCase();
      const matchSearch =
        p.sku.toLowerCase().includes(search) ||
        p.name.toLowerCase().includes(search) ||
        p.barcode.toLowerCase().includes(search) ||
        p.binLocation.toLowerCase().includes(search);

      let matchStock = true;
      if (stockFilter === 'SAFE') {
        matchStock = p.availableStock > p.minStock;
      } else if (stockFilter === 'LOW') {
        matchStock = p.availableStock > 0 && p.availableStock <= p.minStock;
      } else if (stockFilter === 'OUT_OF_STOCK') {
        matchStock = p.availableStock === 0;
      }

      return matchSearch && matchStock;
    });

    // Apply Sorting
    list.sort((a, b) => {
      if (sortOption === 'SKU_ASC') {
        return a.sku.localeCompare(b.sku, undefined, { numeric: true });
      }
      if (sortOption === 'SKU_DESC') {
        return b.sku.localeCompare(a.sku, undefined, { numeric: true });
      }
      if (sortOption === 'NAME_ASC') {
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      }
      if (sortOption === 'NAME_DESC') {
        return b.name.localeCompare(a.name, undefined, { numeric: true });
      }
      if (sortOption === 'STOCK_DESC') {
        return b.availableStock - a.availableStock;
      }
      if (sortOption === 'STOCK_ASC') {
        return a.availableStock - b.availableStock;
      }
      return 0;
    });

    return list;
  }, [products, searchTerm, stockFilter, sortOption]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormError(null);
    setFormData({
      sku: '',
      name: '',
      barcode: '',
      binLocation: 'Rak A-01-B1',
      unit: 'Pcs',
      availableStock: 10,
      minStock: 5,
    });
    setIsAddEditModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormError(null);
    setFormData({
      sku: product.sku,
      name: product.name,
      barcode: product.barcode,
      binLocation: product.binLocation,
      unit: product.unit,
      availableStock: product.availableStock,
      minStock: product.minStock,
    });
    setIsAddEditModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const finalSku = formData.sku.trim().toUpperCase();
    const finalBarcode = formData.barcode.trim() || finalSku;
    const finalName = formData.name.trim();

    if (!finalSku || !finalName) {
      setFormError('Mohon lengkapi Kode SKU dan Nama Barang.');
      return;
    }

    const payload = {
      ...formData,
      sku: finalSku,
      barcode: finalBarcode,
      name: finalName,
    };

    if (editingProduct) {
      await inventoryStore.updateProduct(editingProduct.id, payload, currentUser?.name || 'RAIA HAIKAL RABBANI');
      setFeedbackBanner({
        type: 'success',
        message: `Data barang SKU ${finalSku} berhasil diperbarui (Barcode: ${finalBarcode}).`,
      });
    } else {
      const existing = products.find(
        (p) => p.sku.toLowerCase() === finalSku.toLowerCase()
      );
      if (existing) {
        setFormError(`Kode SKU "${finalSku}" sudah terdaftar pada barang "${existing.name}".`);
        return;
      }
      await inventoryStore.addProduct(payload, currentUser?.name || 'RAIA HAIKAL RABBANI');
      setFeedbackBanner({
        type: 'success',
        message: `Barang baru SKU ${finalSku} berhasil ditambahkan ke katalog (Barcode: ${finalBarcode}).`,
      });
    }

    setIsAddEditModalOpen(false);
  };

  const handleExecuteDelete = async () => {
    if (!productToDelete) return;
    const toDelete = productToDelete;
    setIsDeleting(true);
    try {
      const targetKey = toDelete.id || toDelete.sku;
      const userName = currentUser?.name || 'RAIA HAIKAL RABBANI';
      const success = await inventoryStore.deleteProduct(targetKey, userName);
      if (success) {
        setFeedbackBanner({
          type: 'success',
          message: `Barang SKU ${toDelete.sku} (${toDelete.name}) berhasil dihapus dari Master Data.`,
        });
      } else {
        setFeedbackBanner({
          type: 'error',
          message: `Gagal menemukan data barang SKU ${toDelete.sku} untuk dihapus.`,
        });
      }
    } catch (err) {
      console.error('Delete error:', err);
      setFeedbackBanner({
        type: 'error',
        message: `Gagal menghapus barang SKU ${toDelete.sku}.`,
      });
    } finally {
      setIsDeleting(false);
      setProductToDelete(null);
    }
  };

  const handleScanResult = (code: string) => {
    if (scannerTarget === 'SEARCH') {
      setSearchTerm(code);
    } else {
      setFormData((prev) => ({ ...prev, barcode: code }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 animate-in fade-in ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5 font-bold">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            onClick={() => setFeedbackBanner(null)}
            className="text-slate-400 hover:text-slate-700 font-bold text-xs"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Header & Action Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Master Data Barang &amp; Katalog SKU
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-900 text-white">
              {filteredProducts.length} SKU
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Data SKU barang, lokasi rak penyimpanan, nomor barcode scanner, dan stok fisik gudang.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSyncOfficialCatalog}
            disabled={isSyncingSeed}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs border border-slate-700"
            title="Sinkronisasi 83 barang resmi dari lembar inventaris gudang"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isSyncingSeed ? 'animate-spin' : ''}`} />
            <span>{isSyncingSeed ? 'Menyinkronkan...' : 'Muat 83 Barang Resmi'}</span>
          </button>

          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => exportMasterDataExcel(products)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              title="Unduh Excel urut abjad SKU (A-Z)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Ekspor Excel (SKU A-Z)</span>
            </button>
            <button
              onClick={() => exportMasterDataCSV(products)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              title="Unduh CSV urut abjad SKU (A-Z)"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>CSV</span>
            </button>
          </div>

          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Barang Baru</span>
          </button>
        </div>
      </div>

      {/* Filter, Sort & Instant Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari SKU, Nama Barang, Barcode, Lokasi Rak..."
              className="w-full pl-10 pr-24 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white font-medium"
            />
            <button
              type="button"
              onClick={() => {
                setScannerTarget('SEARCH');
                setIsScannerOpen(true);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-semibold flex items-center gap-1 hover:bg-slate-800 transition cursor-pointer"
            >
              <Camera className="w-3 h-3 text-blue-400" />
              <span>Scan</span>
            </button>
          </div>

          {/* Sorting Dropdown Filter (A-Z SKU, A-Z Nama, Stok) */}
          <div className="w-full sm:w-auto flex items-center gap-2">
            <div className="relative w-full sm:w-56">
              <ArrowUpDown className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as ProductSortOption)}
                className="w-full text-xs font-semibold py-2.5 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="SKU_ASC">Urut: SKU (A &rarr; Z)</option>
                <option value="SKU_DESC">Urut: SKU (Z &rarr; A)</option>
                <option value="NAME_ASC">Urut: Nama Barang (A &rarr; Z)</option>
                <option value="NAME_DESC">Urut: Nama Barang (Z &rarr; A)</option>
                <option value="STOCK_DESC">Urut: Stok Terbanyak</option>
                <option value="STOCK_ASC">Urut: Stok Tersedikit</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stock Status Filter Buttons */}
        <div className="flex items-center gap-2 pt-1 overflow-x-auto text-xs font-semibold">
          <span className="text-slate-400 text-[11px] flex items-center gap-1 shrink-0">
            <Filter className="w-3 h-3" /> Status Stok:
          </span>
          <button
            onClick={() => setStockFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition shrink-0 cursor-pointer ${
              stockFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({products.length})
          </button>
          <button
            onClick={() => setStockFilter('SAFE')}
            className={`px-3 py-1.5 rounded-lg transition shrink-0 cursor-pointer ${
              stockFilter === 'SAFE'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            Stok Aman ({products.filter((p) => p.availableStock > p.minStock).length})
          </button>
          <button
            onClick={() => setStockFilter('LOW')}
            className={`px-3 py-1.5 rounded-lg transition shrink-0 cursor-pointer ${
              stockFilter === 'LOW'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            Stok Menipis ({products.filter((p) => p.availableStock > 0 && p.availableStock <= p.minStock).length})
          </button>
          <button
            onClick={() => setStockFilter('OUT_OF_STOCK')}
            className={`px-3 py-1.5 rounded-lg transition shrink-0 cursor-pointer ${
              stockFilter === 'OUT_OF_STOCK'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            Habis ({products.filter((p) => p.availableStock === 0).length})
          </button>
        </div>
      </div>

      {/* Catalog Display: Table on Desktop/Tablet, Cards on Mobile */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Desktop & Tablet Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
              <tr>
                <th className="py-3 px-4">Kode SKU</th>
                <th className="py-3 px-4">Nama Barang Lengkap</th>
                <th className="py-3 px-4">Barcode</th>
                <th className="py-3 px-4">Lokasi Rak / Bin</th>
                <th className="py-3 px-4 text-center">Stok Fisik</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">Belum ada barang di katalog</p>
                    <p className="text-[11px] mt-1 text-slate-500">
                      Klik tombol di bawah untuk memuat 83 data barang resmi dari lembar inventaris gudang.
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <button
                        onClick={handleSyncOfficialCatalog}
                        disabled={isSyncingSeed}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isSyncingSeed ? 'animate-spin' : ''}`} />
                        <span>{isSyncingSeed ? 'Menyinkronkan...' : 'Muat 83 Barang Resmi'}</span>
                      </button>
                      <button
                        onClick={openAddModal}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Manual</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const isLow = product.availableStock <= product.minStock && product.availableStock > 0;
                  const isOut = product.availableStock === 0;

                  return (
                    <tr key={product.id} className="hover:bg-slate-50/80 transition">
                      {/* SKU */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-sm whitespace-nowrap">
                        {product.sku}
                      </td>

                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 font-semibold max-w-sm line-clamp-1">
                          {product.name}
                        </div>
                      </td>

                      {/* Barcode */}
                      <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <BarcodeIcon className="w-4 h-4 text-slate-400" />
                          <span>{product.barcode}</span>
                        </div>
                      </td>

                      {/* Bin Location */}
                      <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-blue-600" />
                          <span>{product.binLocation}</span>
                        </div>
                      </td>

                      {/* Stock Physical */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div
                          className={`text-base font-black ${
                            isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'
                          }`}
                        >
                          {product.availableStock}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {product.unit} (Min: {product.minStock})
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            <XCircle className="w-3 h-3" /> Habis
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" /> Menipis
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Aman
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setLabelProduct(product)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Lihat / Cetak Label Barcode"
                          >
                            <BarcodeIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(product)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Ubah Data SKU"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setProductToDelete(product)}
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Hapus Barang"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Friendly Cards View (Eliminates horizontal scrolling on smartphones) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredProducts.length === 0 ? (
            <div className="py-10 px-4 text-center text-slate-400">
              <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-slate-600 text-xs">Belum ada barang di katalog</p>
              <p className="text-[11px] mt-1 text-slate-500">
                Muat 83 data barang resmi dari lembar inventaris gudang sekarang:
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  onClick={handleSyncOfficialCatalog}
                  disabled={isSyncingSeed}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isSyncingSeed ? 'animate-spin' : ''}`} />
                  <span>{isSyncingSeed ? 'Menyinkronkan...' : 'Muat 83 Barang Resmi'}</span>
                </button>
              </div>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const isLow = product.availableStock <= product.minStock && product.availableStock > 0;
              const isOut = product.availableStock === 0;

              return (
                <div key={product.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono font-bold text-sm text-slate-900">{product.sku}</div>
                      <div className="text-xs font-semibold text-slate-800 line-clamp-2">{product.name}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-base font-black ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                        {product.availableStock} <span className="text-[10px] font-normal text-slate-500">{product.unit}</span>
                      </div>
                      {isOut ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800">
                          Habis
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                          Menipis
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                          Aman
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span className="font-mono flex items-center gap-1">
                      <BarcodeIcon className="w-3 h-3 text-slate-400" />
                      {product.barcode}
                    </span>
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <MapPin className="w-3 h-3 text-blue-600" />
                      {product.binLocation}
                    </span>
                  </div>

                  {/* Large Touch Actions for Mobile */}
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <button
                      onClick={() => setLabelProduct(product)}
                      className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <BarcodeIcon className="w-3.5 h-3.5" />
                      <span>Label</span>
                    </button>
                    <button
                      onClick={() => openEditModal(product)}
                      className="py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Ubah</span>
                    </button>
                    <button
                      onClick={() => setProductToDelete(product)}
                      className="py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">
                  {editingProduct ? 'Ubah Data SKU Barang' : 'Tambah SKU Master Baru'}
                </h3>
                <p className="text-xs text-slate-300">
                  Kode SKU dan nomor barcode wajib unik untuk presisi scanner.
                </p>
              </div>
              <button
                onClick={() => setIsAddEditModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* SKU Code */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Kode SKU Unik <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => {
                      const newSku = e.target.value.toUpperCase();
                      setFormData((prev) => ({
                        ...prev,
                        sku: newSku,
                        barcode: (!prev.barcode || prev.barcode === prev.sku) ? newSku : prev.barcode,
                      }));
                    }}
                    placeholder="misal: (A)-A01-1"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500 uppercase"
                  />
                </div>

                {/* Barcode Number with Scanner Trigger */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nomor Barcode (Sama dengan SKU) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      placeholder="Sama dengan SKU"
                      className="w-full pl-3 pr-14 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:border-blue-500 font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setScannerTarget('FORM_BARCODE');
                        setIsScannerOpen(true);
                      }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
                      title="Scan Barcode via Kamera HP"
                    >
                      <Camera className="w-3.5 h-3.5 text-blue-400" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Product Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Barang Lengkap <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="misal: TP4056 MICRO USB + PROTECH"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              {/* Bin Location */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Lokasi Rak / Bin Gudang
                </label>
                <input
                  type="text"
                  value={formData.binLocation}
                  onChange={(e) => setFormData({ ...formData, binLocation: e.target.value })}
                  placeholder="misal: Rak A-01-B1"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Unit */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Satuan</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-semibold cursor-pointer"
                  >
                    <option value="Pcs">Pcs</option>
                    <option value="Box">Box</option>
                    <option value="Pack">Pack</option>
                    <option value="Set">Set</option>
                  </select>
                </div>

                {/* Available Stock */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stok Awal</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.availableStock}
                    onChange={(e) =>
                      setFormData({ ...formData, availableStock: Math.max(0, parseInt(e.target.value) || 0) })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-bold"
                  />
                </div>

                {/* Min Stock */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Min. Stok (Alert)</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.minStock}
                    onChange={(e) =>
                      setFormData({ ...formData, minStock: Math.max(0, parseInt(e.target.value) || 0) })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-bold"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-md shadow-blue-600/20"
                >
                  {editingProduct ? 'Simpan Perubahan' : 'Tambah ke Katalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Label Print Card Modal */}
      {labelProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarcodeIcon className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-sm">Label Barcode SKU</span>
              </div>
              <button
                onClick={() => setLabelProduct(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 bg-slate-100 flex flex-col items-center">
              <div className="w-full bg-white p-5 rounded-xl border border-slate-300 shadow-sm text-center space-y-2">
                <div className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">
                  PRIANGLAB WAREHOUSE
                </div>
                <div className="font-mono font-black text-xl text-slate-900">
                  {labelProduct.sku}
                </div>
                <div className="text-xs text-slate-700 font-semibold line-clamp-2">
                  {labelProduct.name}
                </div>

                <div className="py-2 flex flex-col items-center justify-center">
                  <div className="flex items-end justify-center h-14 gap-[2px]">
                    {[4, 2, 5, 2, 4, 3, 6, 2, 4, 5, 3, 2, 4, 6, 2, 5, 3, 4, 2, 5].map((w, i) => (
                      <div key={i} className="bg-black h-full" style={{ width: `${w}px` }} />
                    ))}
                  </div>
                  <div className="font-mono text-xs tracking-widest text-slate-800 font-bold mt-1">
                    {labelProduct.barcode}
                  </div>
                </div>

                <div className="pt-2 border-t border-dashed border-slate-200 flex justify-between text-[11px] text-slate-600">
                  <span>Bin: <strong>{labelProduct.binLocation}</strong></span>
                  <span>Satuan: <strong>{labelProduct.unit}</strong></span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center">
              <span className="text-xs text-slate-500">Ukuran Standar 50x30 mm</span>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Label</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScanResult}
        title={scannerTarget === 'SEARCH' ? 'Scan Barcode untuk Mencari' : 'Scan Nomor Barcode Produk'}
        subtitle="Arahkan kamera ke barcode EAN-13 / Code 128 produk"
      />

      {/* Delete Confirmation Modal (100% reliable in-app, replaces window.confirm) */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600/30 border border-rose-500/40 text-rose-400 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Hapus Barang dari Master Data</h3>
                  <p className="text-xs text-slate-400">Konfirmasi tindakan penghapusan</p>
                </div>
              </div>
              <button
                onClick={() => setProductToDelete(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-black text-rose-950 bg-rose-200/60 px-2 py-0.5 rounded">
                    {productToDelete.sku}
                  </span>
                  <span className="font-semibold text-rose-900">{productToDelete.name}</span>
                </div>
                <div className="text-[11px] text-rose-700 flex justify-between pt-1 border-t border-rose-200/60">
                  <span>Stok Fisik Tersedia: <strong>{productToDelete.availableStock} {productToDelete.unit}</strong></span>
                  <span>Lokasi: <strong>{productToDelete.binLocation}</strong></span>
                </div>
              </div>

              <p className="text-slate-600 text-xs leading-relaxed">
                Apakah Anda yakin ingin menghapus barang ini secara permanen dari katalog Master Data? Data riwayat transaksi sebelumnya tetap tersimpan di Log Audit.
              </p>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setProductToDelete(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleExecuteDelete}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition shadow-lg shadow-rose-600/30 text-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus Barang Ini'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
