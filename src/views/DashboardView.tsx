import React from 'react';
import {
  Boxes,
  PackagePlus,
  PackageMinus,
  Barcode,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Server,
  CloudCheck,
} from 'lucide-react';
import { Product, ActivityLog, PackerSession, PackerResiItem } from '../types';

interface DashboardViewProps {
  products: Product[];
  logs: ActivityLog[];
  session: PackerSession;
  resiItems: PackerResiItem[];
  isFirestoreLive: boolean;
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  products,
  logs,
  session,
  resiItems,
  isFirestoreLive,
  onNavigate,
}) => {
  // Calculations
  const totalSKU = products.length;
  const totalPhysicalStock = products.reduce((acc, p) => acc + p.availableStock, 0);

  const todayStr = new Date().toISOString().slice(0, 10);

  const inboundToday = logs
    .filter((l) => l.type === 'INBOUND' && l.createdAt.startsWith(todayStr))
    .reduce((acc, l) => acc + (l.quantity || 0), 0);

  const outboundToday = logs
    .filter((l) => (l.type === 'OUTBOUND' || l.type === 'SCAN_PACKER') && l.createdAt.startsWith(todayStr))
    .reduce((acc, l) => acc + (l.quantity || 0), 0);

  // Ready to ship (Scanned Out items)
  const readyToShipCount = resiItems.filter((i) => i.isScannedOut).length;
  const pendingPackCount = resiItems.filter((i) => !i.isScannedOut).length;

  // Low stock products
  const lowStockProducts = products.filter((p) => p.availableStock <= p.minStock);

  return (
    <div className="space-y-6">
      {/* Top Banner & Cloud Database Status */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Dashboard Ringkasan Gudang
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              PriangLab WMS
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Monitoring perputaran stok real-time, status pemindaian ekspedisi, dan peringatan inventaris.
          </p>
        </div>

        {/* Database Connection Pill */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
              isFirestoreLive
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-amber-50 border-amber-300 text-amber-800'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isFirestoreLive ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'
              }`}
            />
            <span>
              {isFirestoreLive
                ? 'Google Cloud Firestore Real-Time Aktif'
                : 'Local Storage Fallback Aktif'}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total SKU */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden group hover:border-blue-400 transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total SKU Katalog</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{totalSKU}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>Barang aktif di katalog</span>
          </div>
        </div>

        {/* Total Stock QTY */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden group hover:border-emerald-400 transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Stok Fisik Gudang</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700">{totalPhysicalStock.toLocaleString()}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            Unit barang siap edar
          </div>
        </div>

        {/* Inbound Today */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden group hover:border-indigo-400 transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Masuk Hari Ini</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <PackagePlus className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-600">+{inboundToday}</div>
          <div className="text-[11px] text-slate-500 mt-1">Penerimaan barang</div>
        </div>

        {/* Outbound Today */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden group hover:border-rose-400 transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Keluar / Packing</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <PackageMinus className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-rose-600">-{outboundToday}</div>
          <div className="text-[11px] text-slate-500 mt-1">Distribusi &amp; packing</div>
        </div>

        {/* Ready to Ship (Packer) */}
        <div className="col-span-2 lg:col-span-1 bg-slate-900 rounded-2xl border border-slate-800 p-4 text-white shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Siap Serah Terima</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-400">{readyToShipCount} Resi</div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Pending: {pendingPackCount} resi</span>
            <span className="text-blue-400 font-semibold cursor-pointer hover:underline" onClick={() => onNavigate('packer')}>
              Buka Meja &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* Low Stock Warning Banner & Table */}
      {lowStockProducts.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-300/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>Peringatan Stok Menipis ({lowStockProducts.length} SKU Perlu Re-order Segera)</span>
            </div>
            <button
              onClick={() => onNavigate('master_data')}
              className="text-xs font-semibold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
            >
              Lihat di Master Data <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {lowStockProducts.map((prod) => (
              <div
                key={prod.id}
                className="bg-white rounded-xl border border-amber-200 p-3.5 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-mono font-bold text-slate-900">{prod.sku}</div>
                  <div className="text-xs text-slate-600 truncate max-w-[180px] font-medium mt-0.5">
                    {prod.name}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Lokasi: <span className="font-semibold text-slate-700">{prod.binLocation}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-sm font-black ${
                      prod.availableStock === 0 ? 'text-rose-600' : 'text-amber-600'
                    }`}
                  >
                    {prod.availableStock} {prod.unit}
                  </div>
                  <div className="text-[10px] text-slate-400">Min: {prod.minStock}</div>
                  <span
                    className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                      prod.availableStock === 0
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {prod.availableStock === 0 ? 'Habis' : 'Menipis'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Action Cards & Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Operations shortcuts */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
            Aksi Cepat Operasional
          </h2>

          <div className="space-y-2.5">
            <button
              onClick={() => onNavigate('packer')}
              className="w-full text-left p-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition flex items-center justify-between cursor-pointer group shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <Barcode className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs">Meja Scan Packer Ekspedisi</div>
                  <div className="text-[11px] text-slate-400">Scan resi &amp; kurangi stok otomatis</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition" />
            </button>

            <button
              onClick={() => onNavigate('inbound')}
              className="w-full text-left p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-900 transition flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs">Penerimaan Inbound (Masuk)</div>
                  <div className="text-[11px] text-slate-500">Scan barcode PO dari supplier/konveksi</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 group-hover:translate-x-0.5 transition" />
            </button>

            <button
              onClick={() => onNavigate('outbound')}
              className="w-full text-left p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-900 transition flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                  <PackageMinus className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs">Pengeluaran Outbound (Keluar)</div>
                  <div className="text-[11px] text-slate-500">Distribusi grosir &amp; transfer barang</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 group-hover:translate-x-0.5 transition" />
            </button>
          </div>

          {/* Active Session Info Box */}
          <div className="mt-4 p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 space-y-1">
            <div className="font-bold flex items-center justify-between">
              <span>Sesi Packer Terbuka:</span>
              <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">
                {session.status}
              </span>
            </div>
            <div className="text-slate-700 font-medium truncate">{session.batchTitle}</div>
            <div className="text-[11px] text-slate-500">
              Total {session.totalResi} resi &bull; {session.totalQty} pcs barang
            </div>
          </div>
        </div>

        {/* Recent Audit Log Stream */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Aktivitas Gudang Terbaru
                </h2>
                <p className="text-xs text-slate-500">Audit trail pergerakan stok real-time</p>
              </div>
              <button
                onClick={() => onNavigate('activity_logs')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                Semua Log <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {logs.slice(0, 5).map((log) => (
                <div key={log.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          log.type === 'INBOUND'
                            ? 'bg-indigo-100 text-indigo-800'
                            : log.type === 'OUTBOUND'
                            ? 'bg-rose-100 text-rose-800'
                            : log.type === 'SCAN_PACKER'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {log.type}
                      </span>
                      <span className="font-semibold text-slate-800">{log.details}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span>Oleh: {log.user}</span>
                      {log.sku && <span>&bull; SKU: <strong className="font-mono text-slate-700">{log.sku}</strong></span>}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Integritas data diverifikasi secara berkala
            </span>
            <span>{logs.length} total riwayat tercatat</span>
          </div>
        </div>
      </div>
    </div>
  );
};
