import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { Camera, Zap, ZapOff, X, RefreshCw, AlertCircle, Barcode, Check } from 'lucide-react';
import { beeper } from '../utils/audio';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (scannedText: string) => void;
  title?: string;
  subtitle?: string;
  placeholder?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Barcode / Resi',
  subtitle = 'Arahkan kamera ke barcode 1D / QR Code',
  placeholder = 'Atau ketik manual No. Resi / SKU...',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamTrackRef = useRef<MediaStreamTrack | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [manualCode, setManualCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastScannedResult, setLastScannedResult] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    setErrorMessage(null);
    setLastScannedResult(null);

    const reader = new BrowserMultiFormatReader();
    codeReaderRef.current = reader;

    // List available video input devices
    reader
      .listVideoInputDevices()
      .then((videoInputDevices) => {
        setDevices(videoInputDevices);
        if (videoInputDevices.length > 0) {
          // Find back camera if available
          const backCam = videoInputDevices.find(
            (device) =>
              device.label.toLowerCase().includes('back') ||
              device.label.toLowerCase().includes('rear') ||
              device.label.toLowerCase().includes('belakang') ||
              device.label.toLowerCase().includes('environment')
          );
          const defaultId = backCam ? backCam.deviceId : videoInputDevices[0].deviceId;
          setSelectedDeviceId(defaultId);
          startScanning(reader, defaultId);
        } else {
          setHasCameraPermission(false);
          setErrorMessage('Tidak ada kamera terdeteksi pada perangkat ini.');
        }
      })
      .catch((err) => {
        console.error('Error listing camera devices:', err);
        setHasCameraPermission(false);
        setErrorMessage('Izin kamera ditolak atau tidak didukung pada browser ini.');
      });

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const startScanning = async (reader: BrowserMultiFormatReader, deviceId: string) => {
    if (!videoRef.current) return;
    try {
      setErrorMessage(null);
      await reader.decodeFromVideoDevice(
        deviceId || null,
        videoRef.current,
        (result, err) => {
          if (result) {
            const text = result.getText();
            setLastScannedResult(text);
            beeper.playSuccess();
            onScan(text);
            // Auto close after brief pause
            setTimeout(() => {
              onClose();
            }, 300);
          }
          if (err && !(err instanceof NotFoundException)) {
            // Normal scanning noise, do not treat as fatal
          }
        }
      );

      setHasCameraPermission(true);

      // Check flashlight/torch capability from active stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        const tracks = stream.getVideoTracks();
        if (tracks.length > 0) {
          streamTrackRef.current = tracks[0];
          const capabilities = (tracks[0] as unknown as { getCapabilities?: () => { torch?: boolean } }).getCapabilities?.();
          setTorchAvailable(Boolean(capabilities?.torch));
        }
      }
    } catch (err: unknown) {
      console.error('Error starting video stream:', err);
      setHasCameraPermission(false);
      setErrorMessage(
        'Gagal mengakses kamera. Pastikan Anda mengizinkan akses kamera pada peramban web.'
      );
    }
  };

  const stopScanner = () => {
    if (streamTrackRef.current && torchEnabled) {
      try {
        (streamTrackRef.current as unknown as { applyConstraints: (c: unknown) => Promise<void> }).applyConstraints({
          advanced: [{ torch: false }],
        });
      } catch {
        // Ignore
      }
    }
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    streamTrackRef.current = null;
    setTorchEnabled(false);
  };

  const toggleTorch = async () => {
    if (!streamTrackRef.current) return;
    try {
      const next = !torchEnabled;
      await (streamTrackRef.current as unknown as { applyConstraints: (c: unknown) => Promise<void> }).applyConstraints({
        advanced: [{ torch: next }],
      });
      setTorchEnabled(next);
    } catch (err) {
      console.warn('Torch not supported or failed:', err);
    }
  };

  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedDeviceId(newId);
    stopScanner();
    const reader = new BrowserMultiFormatReader();
    codeReaderRef.current = reader;
    startScanning(reader, newId);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    beeper.playSuccess();
    onScan(manualCode.trim());
    setManualCode('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col text-white max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">{title}</h3>
              <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Viewport Area */}
        <div className="relative bg-black flex-1 min-h-[260px] max-h-[360px] flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />

          {/* Reticle / Viewfinder Frame */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
            <div className="w-64 h-44 sm:w-72 sm:h-48 border-2 border-dashed border-blue-400/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(15,23,42,0.65)]">
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />

              {/* Scanning red laser line */}
              <div className="absolute left-2 right-2 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-bounce top-1/2 -translate-y-1/2" />

              {/* Target hint */}
              <div className="absolute -bottom-7 left-0 right-0 text-center">
                <span className="text-[11px] font-medium bg-slate-900/90 text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-700">
                  Posisikan Barcode di Tengah Kotak
                </span>
              </div>
            </div>
          </div>

          {/* Last scanned success overlay */}
          {lastScannedResult && (
            <div className="absolute inset-0 bg-emerald-950/80 flex flex-col items-center justify-center text-center p-4 animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-2 shadow-lg shadow-emerald-500/50">
                <Check className="w-7 h-7" />
              </div>
              <div className="text-xs uppercase font-bold tracking-wider text-emerald-400">Barcode Terdeteksi!</div>
              <div className="text-base font-mono font-bold text-white mt-1 break-all bg-black/40 px-3 py-1 rounded">
                {lastScannedResult}
              </div>
            </div>
          )}

          {/* Error / No camera overlay */}
          {errorMessage && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-center p-6 text-rose-300">
              <AlertCircle className="w-10 h-10 mb-2 text-rose-400" />
              <p className="text-xs max-w-xs">{errorMessage}</p>
              <p className="text-[11px] text-slate-400 mt-2">
                Gunakan input manual di bawah atau scanner barcode USB/Bluetooth.
              </p>
            </div>
          )}

          {/* Floating Camera Controls (Torch & Switch) */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            {torchAvailable && (
              <button
                type="button"
                onClick={toggleTorch}
                title="Nyalakan Lampu Senter"
                className={`p-2 rounded-xl backdrop-blur-md transition cursor-pointer ${
                  torchEnabled
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
                    : 'bg-slate-900/80 text-white hover:bg-slate-800'
                }`}
              >
                {torchEnabled ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}
            {devices.length > 1 && (
              <div className="relative">
                <select
                  value={selectedDeviceId}
                  onChange={handleDeviceChange}
                  className="bg-slate-900/80 backdrop-blur-md text-white text-xs py-1.5 px-2.5 rounded-xl border border-slate-700 outline-none cursor-pointer"
                >
                  {devices.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Kamera ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Manual Input Fallback */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-md shadow-blue-600/20"
            >
              Kirim
            </button>
          </form>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span>Hardware USB / Bluetooth Laser Scanner aktif otomatis</span>
            <button
              type="button"
              onClick={() => {
                if (codeReaderRef.current && selectedDeviceId) {
                  stopScanner();
                  const reader = new BrowserMultiFormatReader();
                  codeReaderRef.current = reader;
                  startScanning(reader, selectedDeviceId);
                }
              }}
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Refresh Kamera
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
