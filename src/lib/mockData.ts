import { Product, ActivityLog, PackerSession, PackerResiItem } from '../types';
import { MASTER_CATALOG_PRODUCTS } from './masterCatalogSeed';

// 83 Master Data Barang resmi inventaris gudang
export const INITIAL_PRODUCTS: Product[] = MASTER_CATALOG_PRODUCTS;

export const INITIAL_ACTIVITY_LOGS: ActivityLog[] = [];

export const INITIAL_PACKER_SESSION: PackerSession = {
  id: 'session_' + Date.now(),
  batchTitle: 'Sheet Packer 1-10-2026',
  totalResi: 0,
  totalQty: 0,
  scannedOutCount: 0,
  status: 'ACTIVE',
  createdBy: 'RAIA HAIKAL RABBANI',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const INITIAL_RESI_ITEMS: PackerResiItem[] = [];
