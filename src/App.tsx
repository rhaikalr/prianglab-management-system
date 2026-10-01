import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { PWAInstallModal } from './components/PWAInstallModal';
import { DashboardView } from './views/DashboardView';
import { MasterDataView } from './views/MasterDataView';
import { InboundView } from './views/InboundView';
import { OutboundView } from './views/OutboundView';
import { PackerView } from './views/PackerView';
import { ActivityLogsView } from './views/ActivityLogsView';
import { LoginView } from './views/LoginView';
import { inventoryStore } from './lib/inventoryStore';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { WifiOff, Heart } from 'lucide-react';

function MainApp() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('packer'); // Default to Scan Packer as main packing module
  const [isPWAInstallOpen, setIsPWAInstallOpen] = useState(false);
  const isOnline = useOnlineStatus();

  // Reactive store state
  const [products, setProducts] = useState(inventoryStore.getProducts());
  const [inbound, setInbound] = useState(inventoryStore.getInbound());
  const [outbound, setOutbound] = useState(inventoryStore.getOutbound());
  const [logs, setLogs] = useState(inventoryStore.getLogs());
  const [session, setSession] = useState(inventoryStore.getPackerSession());
  const [resiItems, setResiItems] = useState(inventoryStore.getResiItems());
  const [isFirestoreLive, setIsFirestoreLive] = useState(inventoryStore.isFirestoreLive);

  useEffect(() => {
    // Start firestore real-time sync
    inventoryStore.init();

    // Subscribe to store updates
    const unsubscribe = inventoryStore.subscribe(() => {
      setProducts(inventoryStore.getProducts());
      setInbound(inventoryStore.getInbound());
      setOutbound(inventoryStore.getOutbound());
      setLogs(inventoryStore.getLogs());
      setSession(inventoryStore.getPackerSession());
      setResiItems(inventoryStore.getResiItems());
      setIsFirestoreLive(inventoryStore.isFirestoreLive);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Require Login
  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isFirestoreLive={isFirestoreLive}
        onOpenPWAInstall={() => setIsPWAInstallOpen(true)}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {activeTab === 'dashboard' && (
          <DashboardView
            products={products}
            logs={logs}
            session={session}
            resiItems={resiItems}
            isFirestoreLive={isFirestoreLive}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'master_data' && <MasterDataView products={products} />}

        {activeTab === 'inbound' && (
          <InboundView products={products} inboundRecords={inbound} />
        )}

        {activeTab === 'outbound' && (
          <OutboundView products={products} outboundRecords={outbound} />
        )}

        {activeTab === 'packer' && (
          <PackerView
            products={products}
            session={session}
            resiItems={resiItems}
          />
        )}

        {activeTab === 'activity_logs' && <ActivityLogsView logs={logs} />}
      </main>

      {/* Subtle Offline Warning Banner */}
      {!isOnline && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xl animate-in slide-in-from-bottom-2">
          <WifiOff className="w-4 h-4" />
          <span>Mode Offline — Perubahan tersimpan dan akan disinkronkan saat terhubung kembali.</span>
        </div>
      )}

      {/* Footer with Watermark */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="font-bold text-slate-800">PriangLab Management System &copy; 2026</span>
            <span>&bull;</span>
            <span className="text-blue-600 font-bold">Made By Raia Haikal Rabbani</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span>Multi-Device Cloud Sync</span>
            <span>&bull;</span>
            <span>Laser &amp; Camera Barcode Scanner PWA</span>
          </div>
        </div>
      </footer>

      {/* PWA Install Modal */}
      <PWAInstallModal
        isOpen={isPWAInstallOpen}
        onClose={() => setIsPWAInstallOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
