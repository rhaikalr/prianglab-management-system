import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Product,
  InboundTransaction,
  OutboundTransaction,
  ActivityLog,
  PackerSession,
  PackerResiItem,
} from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_ACTIVITY_LOGS,
  INITIAL_PACKER_SESSION,
  INITIAL_RESI_ITEMS,
} from './mockData';

// Local storage fallback keys
const LS_PRODUCTS = 'prianglab_products_sku_barcode_v4';
const LS_INBOUND = 'prianglab_inbound_clean_v2';
const LS_OUTBOUND = 'prianglab_outbound_clean_v2';
const LS_LOGS = 'prianglab_logs_clean_v2';
const LS_PACKER_SESSION = 'prianglab_packer_session_clean_v2';
const LS_RESI_ITEMS = 'prianglab_resi_items_clean_v2';

class InventoryStore {
  private products: Product[] = [];
  private inbound: InboundTransaction[] = [];
  private outbound: OutboundTransaction[] = [];
  private logs: ActivityLog[] = [];
  private activeSession: PackerSession = INITIAL_PACKER_SESSION;
  private resiItems: PackerResiItem[] = [];

  private listeners: Set<() => void> = new Set();
  public isFirestoreLive: boolean = false;
  private isInitialized: boolean = false;

  constructor() {
    this.loadFromLocalStorage();
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  private loadFromLocalStorage() {
    try {
      const p = localStorage.getItem(LS_PRODUCTS);
      const rawProducts: Product[] = p ? JSON.parse(p) : INITIAL_PRODUCTS;
      
      // Enforce barcode equals SKU for all loaded items
      this.products = (rawProducts && rawProducts.length > 0 ? rawProducts : INITIAL_PRODUCTS).map((prod) => ({
        ...prod,
        barcode: prod.sku,
      }));

      localStorage.setItem(LS_PRODUCTS, JSON.stringify(this.products));

      const inb = localStorage.getItem(LS_INBOUND);
      this.inbound = inb ? JSON.parse(inb) : [];

      const out = localStorage.getItem(LS_OUTBOUND);
      this.outbound = out ? JSON.parse(out) : [];

      const l = localStorage.getItem(LS_LOGS);
      this.logs = l ? JSON.parse(l) : INITIAL_ACTIVITY_LOGS;

      const sess = localStorage.getItem(LS_PACKER_SESSION);
      this.activeSession = sess ? JSON.parse(sess) : INITIAL_PACKER_SESSION;

      const items = localStorage.getItem(LS_RESI_ITEMS);
      this.resiItems = items ? JSON.parse(items) : INITIAL_RESI_ITEMS;
    } catch {
      this.products = INITIAL_PRODUCTS.map((p) => ({ ...p, barcode: p.sku }));
      this.logs = [];
      this.activeSession = INITIAL_PACKER_SESSION;
      this.resiItems = [];
    }
  }

  private saveToLocalStorage() {
    try {
      localStorage.setItem(LS_PRODUCTS, JSON.stringify(this.products));
      localStorage.setItem(LS_INBOUND, JSON.stringify(this.inbound));
      localStorage.setItem(LS_OUTBOUND, JSON.stringify(this.outbound));
      localStorage.setItem(LS_LOGS, JSON.stringify(this.logs));
      localStorage.setItem(LS_PACKER_SESSION, JSON.stringify(this.activeSession));
      localStorage.setItem(LS_RESI_ITEMS, JSON.stringify(this.resiItems));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  /**
   * Real-time sync with Google Cloud Firestore across all devices
   */
  public async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      // 1. Real-time Products listener
      const productsRef = collection(db, 'products');
      onSnapshot(
        productsRef,
        async (snap) => {
          if (snap.empty) {
            // First time or empty Firestore: seed with 83 master products
            console.log('Seeding 83 Master Products to Firestore with SKU as Barcode...');
            await this.seedFirestoreProducts(INITIAL_PRODUCTS);
            return;
          }
          const list: Product[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data() as Omit<Product, 'id'>;
            list.push({
              id: docSnap.id,
              ...data,
              // Always guarantee barcode equals SKU
              barcode: data.sku || data.barcode,
            });
          });
          // Sort by SKU default
          list.sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }));
          this.products = list;
          this.isFirestoreLive = true;
          this.saveToLocalStorage();
          this.notify();
        },
        (err) => {
          console.warn('Firestore products listener fallback:', err);
          this.isFirestoreLive = false;
        }
      );

      // 2. Real-time Packer Resi Items listener
      const resiRef = collection(db, 'packer_resi_items');
      onSnapshot(
        resiRef,
        (snap) => {
          const list: PackerResiItem[] = [];
          snap.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...(docSnap.data() as Omit<PackerResiItem, 'id'>) });
          });
          // Sort descending by creation
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          this.resiItems = list;
          this.recalculateSessionStats();
          this.saveToLocalStorage();
          this.notify();
        },
        (err) => {
          console.warn('Firestore resi listener fallback:', err);
        }
      );

      // 3. Real-time Active Packer Session listener
      const sessionDocRef = doc(db, 'system_state', 'active_packer_session');
      onSnapshot(
        sessionDocRef,
        (docSnap) => {
          if (docSnap.exists()) {
            this.activeSession = { id: docSnap.id, ...(docSnap.data() as Omit<PackerSession, 'id'>) };
            this.saveToLocalStorage();
            this.notify();
          }
        },
        () => {}
      );

      // 4. Real-time Activity Logs listener
      const logsRef = collection(db, 'activity_logs');
      onSnapshot(
        logsRef,
        (snap) => {
          const list: ActivityLog[] = [];
          snap.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...(docSnap.data() as Omit<ActivityLog, 'id'>) });
          });
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          this.logs = list;
          this.saveToLocalStorage();
          this.notify();
        },
        () => {}
      );
    } catch (e) {
      console.warn('Firestore init catch:', e);
      this.isFirestoreLive = false;
    }
  }

  // Getters
  public getProducts(): Product[] {
    return [...this.products];
  }

  public getInbound(): InboundTransaction[] {
    return [...this.inbound];
  }

  public getOutbound(): OutboundTransaction[] {
    return [...this.outbound];
  }

  public getLogs(): ActivityLog[] {
    return [...this.logs];
  }

  public getPackerSession(): PackerSession {
    return { ...this.activeSession };
  }

  public getResiItems(): PackerResiItem[] {
    return [...this.resiItems];
  }

  /**
   * Find product with strict checking: matches exact barcode or exact SKU
   */
  public findProductByCode(code: string): Product | undefined {
    if (!code) return undefined;
    const clean = code.trim().toLowerCase();
    return this.products.find(
      (p) => p.sku.toLowerCase() === clean || p.barcode.toLowerCase() === clean
    );
  }

  /**
   * Seed all 83 products to Firestore and local state
   */
  public async seedFirestoreProducts(items: Product[] = INITIAL_PRODUCTS): Promise<boolean> {
    try {
      // Split into batches if needed (83 items easily fits in single 500-op batch)
      const batch = writeBatch(db);
      items.forEach((p) => {
        const ref = doc(db, 'products', p.id);
        const barcodeVal = p.sku.trim();
        batch.set(ref, {
          sku: p.sku,
          name: p.name,
          barcode: barcodeVal,
          binLocation: p.binLocation,
          unit: p.unit,
          availableStock: p.availableStock,
          minStock: p.minStock,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        });
      });
      await batch.commit();

      const sorted = items
        .map((p) => ({ ...p, barcode: p.sku.trim() }))
        .sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }));
      this.products = sorted;
      this.saveToLocalStorage();
      this.notify();
      return true;
    } catch (e) {
      console.warn('Batch seed products fallback:', e);
      // Fallback single sets
      items.forEach((p) => {
        const barcodeVal = p.sku.trim();
        setDoc(doc(db, 'products', p.id), {
          sku: p.sku,
          name: p.name,
          barcode: barcodeVal,
          binLocation: p.binLocation,
          unit: p.unit,
          availableStock: p.availableStock,
          minStock: p.minStock,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }).catch(() => {});
      });
      const sorted = items
        .map((p) => ({ ...p, barcode: p.sku.trim() }))
        .sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }));
      this.products = sorted;
      this.saveToLocalStorage();
      this.notify();
      return true;
    }
  }

  // Mutations
  public async addProduct(
    product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>,
    userName: string
  ): Promise<Product> {
    const now = new Date().toISOString();
    const id = 'prod_' + Date.now();
    const skuCode = product.sku.trim().toUpperCase();
    const barcodeCode = product.barcode?.trim() || skuCode;

    const newProduct: Product = {
      ...product,
      sku: skuCode,
      barcode: barcodeCode,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.products.unshift(newProduct);
    this.addLog({
      type: 'MASTER_DATA',
      sku: newProduct.sku,
      productName: newProduct.name,
      details: `Tambah SKU baru: ${newProduct.sku} - ${newProduct.name} (${newProduct.availableStock} ${newProduct.unit})`,
      user: userName,
    });
    this.saveToLocalStorage();
    this.notify();

    // Sync to Firestore
    setDoc(doc(db, 'products', id), {
      sku: newProduct.sku,
      name: newProduct.name,
      barcode: newProduct.barcode,
      binLocation: newProduct.binLocation,
      unit: newProduct.unit,
      availableStock: newProduct.availableStock,
      minStock: newProduct.minStock,
      createdAt: newProduct.createdAt,
      updatedAt: newProduct.updatedAt,
    }).catch((e) => console.warn('Product sync fallback:', e));

    return newProduct;
  }

  public async updateProduct(
    id: string,
    updates: Partial<Product>,
    userName: string
  ): Promise<Product | null> {
    const idx = this.products.findIndex((p) => p.id === id);
    if (idx === -1) return null;

    const existing = this.products[idx];
    const updated: Product = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.products[idx] = updated;
    this.addLog({
      type: 'MASTER_DATA',
      sku: updated.sku,
      productName: updated.name,
      details: `Ubah data SKU ${updated.sku} - ${updated.name}`,
      user: userName,
    });
    this.saveToLocalStorage();
    this.notify();

    updateDoc(doc(db, 'products', id), {
      sku: updated.sku,
      name: updated.name,
      barcode: updated.barcode,
      binLocation: updated.binLocation,
      unit: updated.unit,
      availableStock: updated.availableStock,
      minStock: updated.minStock,
      updatedAt: updated.updatedAt,
    }).catch((e) => console.warn('Product update fallback:', e));

    return updated;
  }

  public async deleteProduct(idOrSku: string, userName: string = 'Admin'): Promise<boolean> {
    if (!idOrSku) return false;
    const clean = idOrSku.trim();
    const cleanLower = clean.toLowerCase();

    // Match by id or SKU
    const item = this.products.find(
      (p) => p.id === clean || p.sku.toLowerCase() === cleanLower
    );

    const targetId = item ? item.id : clean;
    const targetSku = item ? item.sku : clean;
    const targetName = item ? item.name : clean;

    // Immediately remove from in-memory state
    this.products = this.products.filter(
      (p) => p.id !== targetId && p.sku.toLowerCase() !== targetSku.toLowerCase()
    );

    this.addLog({
      type: 'MASTER_DATA',
      sku: targetSku,
      productName: targetName,
      details: `Hapus SKU ${targetSku} (${targetName}) dari katalog Master Data`,
      user: userName,
    });

    this.saveToLocalStorage();
    this.notify();

    // Fire-and-forget Firestore delete with timeout guard so UI never hangs
    try {
      const runDeletion = async () => {
        // Direct document deletion
        try {
          await deleteDoc(doc(db, 'products', targetId));
        } catch (err) {
          console.warn('deleteDoc direct error:', err);
        }

        // Also purge any orphaned docs matching the SKU
        try {
          const snapshot = await getDocs(collection(db, 'products'));
          const deletes: Promise<void>[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            if (
              d.id === targetId ||
              d.id === clean ||
              (data?.sku && data.sku.toLowerCase() === targetSku.toLowerCase())
            ) {
              deletes.push(deleteDoc(d.ref).catch(() => {}));
            }
          });
          if (deletes.length > 0) {
            await Promise.all(deletes);
          }
        } catch (err) {
          console.warn('Firestore products purge error:', err);
        }
      };

      await Promise.race([
        runDeletion(),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    } catch (e) {
      console.warn('Delete product fallback catch:', e);
    }

    return true;
  }

  // Inbound
  public async addInbound(
    sku: string,
    quantity: number,
    poNumber: string,
    notes: string,
    userName: string
  ): Promise<{ success: boolean; message: string }> {
    const product = this.findProductByCode(sku);
    if (!product) {
      return { success: false, message: `Barang dengan SKU/Barcode "${sku}" tidak ditemukan di Master Data.` };
    }

    if (quantity <= 0) {
      return { success: false, message: 'Jumlah barang masuk harus lebih dari 0.' };
    }

    const now = new Date().toISOString();
    const inboundId = 'inb_' + Date.now();
    const inboundRecord: InboundTransaction = {
      id: inboundId,
      poNumber: poNumber.trim() || `PO-${Date.now().toString().slice(-6)}`,
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      quantity,
      notes: notes.trim(),
      createdBy: userName,
      createdAt: now,
    };

    product.availableStock += quantity;
    product.updatedAt = now;

    this.inbound.unshift(inboundRecord);
    this.addLog({
      type: 'INBOUND',
      sku: product.sku,
      productName: product.name,
      quantity,
      details: `Barang Masuk: +${quantity} ${product.unit} (PO: ${inboundRecord.poNumber})${notes ? ` - ${notes}` : ''}`,
      user: userName,
    });

    this.saveToLocalStorage();
    this.notify();

    setDoc(doc(db, 'inbound_transactions', inboundId), inboundRecord).catch(() => {});
    updateDoc(doc(db, 'products', product.id), {
      availableStock: product.availableStock,
      updatedAt: now,
    }).catch(() => {});

    return { success: true, message: `Berhasil menambahkan ${quantity} ${product.unit} untuk SKU ${product.sku}.` };
  }

  // Outbound
  public async addOutbound(
    sku: string,
    quantity: number,
    destination: string,
    notes: string,
    userName: string
  ): Promise<{ success: boolean; message: string }> {
    const product = this.findProductByCode(sku);
    if (!product) {
      return { success: false, message: `Barang dengan SKU/Barcode "${sku}" tidak ditemukan.` };
    }

    if (quantity <= 0) {
      return { success: false, message: 'Kuantitas pengeluaran harus lebih dari 0.' };
    }

    if (product.availableStock < quantity) {
      return {
        success: false,
        message: `Stok tidak mencukupi! Tersedia hanya ${product.availableStock} ${product.unit}, sedangkan permintaan ${quantity} ${product.unit}.`,
      };
    }

    const now = new Date().toISOString();
    const outboundId = 'out_' + Date.now();
    const outboundRecord: OutboundTransaction = {
      id: outboundId,
      transactionNumber: `OUT-${Date.now().toString().slice(-6)}`,
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      quantity,
      destination: destination.trim() || 'Distribusi Grosir',
      notes: notes.trim(),
      createdBy: userName,
      createdAt: now,
    };

    product.availableStock -= quantity;
    product.updatedAt = now;

    this.outbound.unshift(outboundRecord);
    this.addLog({
      type: 'OUTBOUND',
      sku: product.sku,
      productName: product.name,
      quantity,
      details: `Barang Keluar: -${quantity} ${product.unit} ke ${outboundRecord.destination}${notes ? ` - ${notes}` : ''}`,
      user: userName,
    });

    this.saveToLocalStorage();
    this.notify();

    setDoc(doc(db, 'outbound_transactions', outboundId), outboundRecord).catch(() => {});
    updateDoc(doc(db, 'products', product.id), {
      availableStock: product.availableStock,
      updatedAt: now,
    }).catch(() => {});

    return { success: true, message: `Berhasil mengeluarkan ${quantity} ${product.unit} untuk ${product.name}.` };
  }

  // SCAN PACKER: Add Item to Locked Resi
  public async addPackerItem(
    resiNumber: string,
    skuOrBarcode: string,
    quantity: number,
    courierName: string,
    userName: string
  ): Promise<{ success: boolean; message: string; item?: PackerResiItem }> {
    const product = this.findProductByCode(skuOrBarcode);
    if (!product) {
      return {
        success: false,
        message: `SKU/Barcode "${skuOrBarcode}" tidak dikenali di sistem katalog! Pastikan barang sudah didaftarkan di Master Data.`,
      };
    }

    if (product.availableStock < quantity) {
      return {
        success: false,
        message: `Stok ${product.sku} tidak cukup! (Tersedia: ${product.availableStock} ${product.unit}, Diminta: ${quantity} ${product.unit}).`,
      };
    }

    const now = new Date().toISOString();
    const itemId = 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    const newItem: PackerResiItem = {
      id: itemId,
      sessionId: this.activeSession.id,
      sheetTitle: this.activeSession.batchTitle,
      resiNumber: resiNumber.trim().toUpperCase(),
      courier: courierName.trim() || this.detectCourier(resiNumber),
      sku: product.sku,
      productName: product.name,
      quantity,
      isScannedOut: false,
      scannedBy: userName || 'RAIA HAIKAL RABBANI',
      createdAt: now,
    };

    // Auto deduct inventory
    product.availableStock -= quantity;
    product.updatedAt = now;

    this.resiItems.unshift(newItem);
    this.recalculateSessionStats();

    this.addLog({
      type: 'SCAN_PACKER',
      sku: product.sku,
      productName: product.name,
      quantity,
      details: `Scan Resi ${newItem.resiNumber} -> SKU ${product.sku} x${quantity} (${this.activeSession.batchTitle})`,
      user: userName,
    });

    this.saveToLocalStorage();
    this.notify();

    // Multi-device Firestore sync
    setDoc(doc(db, 'packer_resi_items', itemId), newItem).catch(() => {});
    updateDoc(doc(db, 'products', product.id), {
      availableStock: product.availableStock,
      updatedAt: now,
    }).catch(() => {});
    setDoc(doc(db, 'system_state', 'active_packer_session'), this.activeSession).catch(() => {});

    return {
      success: true,
      message: `Berhasil scan ${quantity} pcs ${product.name} ke Resi ${resiNumber}.`,
      item: newItem,
    };
  }

  // Scan Out Single Resi
  public async scanOutResi(
    resiNumber: string,
    userName: string
  ): Promise<{ success: boolean; message: string; count: number }> {
    const clean = resiNumber.trim().toUpperCase();
    const matching = this.resiItems.filter((i) => i.resiNumber.toUpperCase() === clean);

    if (matching.length === 0) {
      return { success: false, message: `Nomor resi "${clean}" tidak ditemukan dalam lembar scan!`, count: 0 };
    }

    const uncompleted = matching.filter((i) => !i.isScannedOut);
    if (uncompleted.length === 0) {
      return { success: false, message: `Resi "${clean}" sudah selesai di-Scan Out sebelumnya.`, count: 0 };
    }

    const now = new Date().toISOString();
    matching.forEach((item) => {
      item.isScannedOut = true;
      item.scannedOutAt = now;
    });

    this.recalculateSessionStats();
    this.addLog({
      type: 'SCAN_PACKER',
      details: `Scan Out Resi: ${clean} (${matching.length} item) - Selesai diserahkan ke kurir`,
      user: userName,
    });

    this.saveToLocalStorage();
    this.notify();

    // Sync to Firestore
    matching.forEach((item) => {
      updateDoc(doc(db, 'packer_resi_items', item.id), {
        isScannedOut: true,
        scannedOutAt: now,
      }).catch(() => {});
    });
    setDoc(doc(db, 'system_state', 'active_packer_session'), this.activeSession).catch(() => {});

    return {
      success: true,
      message: `Resi ${clean} (${matching.length} item) berhasil di-Scan Out!`,
      count: matching.length,
    };
  }

  // Scan Out All Resi (Fixed and fully operational)
  public async scanOutAll(userName: string): Promise<{ success: boolean; count: number; message: string }> {
    const uncompleted = this.resiItems.filter((i) => !i.isScannedOut);
    if (uncompleted.length === 0) {
      return { success: false, count: 0, message: 'Semua resi pada lembar scan ini sudah selesai di-Scan Out!' };
    }

    const now = new Date().toISOString();
    this.resiItems.forEach((i) => {
      i.isScannedOut = true;
      if (!i.scannedOutAt) {
        i.scannedOutAt = now;
      }
    });

    this.recalculateSessionStats();
    this.addLog({
      type: 'SCAN_PACKER',
      details: `Scan Out Massal: Seluruh resi (${uncompleted.length} item) selesai diserahkan ke kurir`,
      user: userName,
    });

    this.saveToLocalStorage();
    this.notify();

    // Firestore batch update
    try {
      const batch = writeBatch(db);
      uncompleted.forEach((item) => {
        const ref = doc(db, 'packer_resi_items', item.id);
        batch.update(ref, {
          isScannedOut: true,
          scannedOutAt: now,
        });
      });
      await batch.commit();
      await setDoc(doc(db, 'system_state', 'active_packer_session'), this.activeSession);
    } catch (e) {
      console.warn('Batch scan out firestore sync:', e);
      // Fallback update individual docs
      uncompleted.forEach((item) => {
        updateDoc(doc(db, 'packer_resi_items', item.id), {
          isScannedOut: true,
          scannedOutAt: now,
        }).catch(() => {});
      });
    }

    return {
      success: true,
      count: uncompleted.length,
      message: `Sukses! ${uncompleted.length} item resi telah ditandai SELESAI (SCAN OUT).`,
    };
  }

  // Create New Batch Sheet (Fixed & robust)
  public async createNewBatchSession(batchTitle: string, userName: string): Promise<PackerSession> {
    const now = new Date().toISOString();
    const cleanTitle = batchTitle.trim() || `Sheet Packer ${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}`;

    const newSession: PackerSession = {
      id: 'session_' + Date.now(),
      batchTitle: cleanTitle,
      totalResi: 0,
      totalQty: 0,
      scannedOutCount: 0,
      status: 'ACTIVE',
      createdBy: userName || 'RAIA HAIKAL RABBANI',
      createdAt: now,
      updatedAt: now,
    };

    this.activeSession = newSession;
    this.addLog({
      type: 'SCAN_PACKER',
      details: `Membuat Lembar Sheet Baru: "${newSession.batchTitle}"`,
      user: userName,
    });

    this.saveToLocalStorage();
    this.notify();

    // Sync active session document to Firestore
    setDoc(doc(db, 'system_state', 'active_packer_session'), newSession).catch(() => {});
    setDoc(doc(db, 'packer_sessions', newSession.id), newSession).catch(() => {});

    return newSession;
  }

  private recalculateSessionStats() {
    const uniqueResi = new Set(this.resiItems.map((i) => i.resiNumber));
    const totalQty = this.resiItems.reduce((acc, curr) => acc + curr.quantity, 0);

    let scannedOutResiCount = 0;
    uniqueResi.forEach((resi) => {
      const items = this.resiItems.filter((i) => i.resiNumber === resi);
      if (items.length > 0 && items.every((i) => i.isScannedOut)) {
        scannedOutResiCount++;
      }
    });

    this.activeSession = {
      ...this.activeSession,
      totalResi: uniqueResi.size,
      totalQty,
      scannedOutCount: scannedOutResiCount,
      updatedAt: new Date().toISOString(),
    };
  }

  private detectCourier(resi: string): string {
    const r = resi.toUpperCase();
    if (r.startsWith('SPX') || (r.startsWith('ID') && r.length > 12)) return 'Shopee Xpress';
    if (r.startsWith('JX') || r.startsWith('JP') || r.startsWith('JT')) return 'J&T Express';
    if (r.startsWith('01') || r.startsWith('JNE') || /^\d{12}$/.test(r)) return 'JNE Express';
    if (r.startsWith('TKP') || r.startsWith('TLX')) return 'SiCepat';
    if (r.startsWith('ANTR')) return 'Anteraja';
    if (r.startsWith('NINJA') || r.startsWith('NLID')) return 'Ninja Xpress';
    if (r.startsWith('LX')) return 'Lazada Express';
    return 'Ekspedisi Reguler';
  }

  private addLog(log: Omit<ActivityLog, 'id' | 'createdAt'>) {
    const id = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newLog: ActivityLog = {
      ...log,
      id,
      createdAt: new Date().toISOString(),
    };
    this.logs.unshift(newLog);

    if (this.logs.length > 300) {
      this.logs = this.logs.slice(0, 300);
    }

    setDoc(doc(db, 'activity_logs', id), newLog).catch(() => {});
  }

  // Clear all data to 0 as user requested
  public clearAllDataToZero(userName: string) {
    this.products = [];
    this.inbound = [];
    this.outbound = [];
    this.logs = [
      {
        id: 'reset_' + Date.now(),
        type: 'MASTER_DATA',
        details: 'Sistem di-reset: seluruh data katalog dikosongkan (Mulai dari 0)',
        user: userName,
        createdAt: new Date().toISOString(),
      },
    ];
    this.activeSession = {
      id: 'session_' + Date.now(),
      batchTitle: `Sheet Packer ${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}`,
      totalResi: 0,
      totalQty: 0,
      scannedOutCount: 0,
      status: 'ACTIVE',
      createdBy: userName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.resiItems = [];

    this.saveToLocalStorage();
    this.notify();

    // Clear firestore active state
    setDoc(doc(db, 'system_state', 'active_packer_session'), this.activeSession).catch(() => {});
  }
}

export const inventoryStore = new InventoryStore();
