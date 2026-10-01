import React from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, Laptop, CheckCircle2, X, ExternalLink, Share, PlusSquare } from 'lucide-react';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    const success = await install();
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Instal PriangLab PWA</h3>
              <p className="text-xs text-slate-300">Aplikasi Web Standalone &amp; Ramah Sentuhan HP</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Status banner */}
          {isInstalled ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Aplikasi sudah terpasang sebagai aplikasi standalone di perangkat ini!</span>
            </div>
          ) : isInstallable ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                Pasang aplikasi di layar utama perangkat Anda untuk akses cepat tanpa membuka browser, pemuatan instan, dan performa optimal saat scan barcode di gudang.
              </p>
              <button
                onClick={handleInstallClick}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-600/20 active:scale-[0.99] transition cursor-pointer"
              >
                <Download className="w-5 h-5" />
                <span>Pasang Sekarang (1-Klik Install)</span>
              </button>
            </div>
          ) : isIOS ? (
            /* iOS Safari Instructions */
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Petunjuk Khusus Apple iOS (Safari iPhone / iPad):</span>
              </div>
              <ol className="space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">1</span>
                  <span>Buka halaman ini menggunakan browser bawaan <strong>Safari</strong>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">2</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>Tekan tombol Bagikan / Share</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-xs font-medium">
                      <Share className="w-3.5 h-3.5" /> Bagikan
                    </span>
                    <span>di menu bawah Safari.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">3</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>Gulir ke bawah dan pilih</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-xs font-semibold text-slate-900">
                      <PlusSquare className="w-3.5 h-3.5" /> Tambah ke Layar Utama
                    </span>
                    <span>(Add to Home Screen).</span>
                  </div>
                </li>
              </ol>
            </div>
          ) : (
            /* Desktop / General Android Chrome Fallback */
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Untuk memasang aplikasi ini di browser Desktop atau Android:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Laptop className="w-4 h-4 text-blue-600" /> Desktop Chrome / Edge
                  </div>
                  <p className="text-slate-500">
                    Klik ikon instal <strong>(tanda komputer panah bawah)</strong> di ujung kanan kolom alamat URL (Omnibox).
                  </p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-blue-600" /> Android Chrome
                  </div>
                  <p className="text-slate-500">
                    Tekan menu titik tiga <strong>(⋮)</strong> di kanan atas, lalu pilih <strong>&quot;Pasang Aplikasi&quot;</strong> atau <strong>&quot;Tambahkan ke Layar Utama&quot;</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Key Advantages */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-slate-50">
              <div className="text-xs font-bold text-slate-900">Offline Ready</div>
              <div className="text-[10px] text-slate-500">Tetap aktif tanpa kuota</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-50">
              <div className="text-xs font-bold text-slate-900">Scanner Cepat</div>
              <div className="text-[10px] text-slate-500">Kamera &amp; Laser USB</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-50">
              <div className="text-xs font-bold text-slate-900">Full Screen</div>
              <div className="text-[10px] text-slate-500">Bebas bilah browser</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
