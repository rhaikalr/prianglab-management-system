export type UserRole = 'ADMIN';

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  roleTitle: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  barcode: string;
  binLocation: string; // e.g. Rak A-01-B1
  unit: string; // Pcs, Box, Set, Pack
  availableStock: number;
  minStock: number;
  createdAt: string;
  updatedAt: string;
}

export interface InboundTransaction {
  id: string;
  poNumber: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface OutboundTransaction {
  id: string;
  transactionNumber: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  destination: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface PackerResiItem {
  id: string;
  sessionId: string;
  sheetTitle: string;
  resiNumber: string;
  courier: string;
  sku: string;
  productName: string;
  quantity: number;
  isScannedOut: boolean;
  scannedOutAt?: string;
  scannedBy: string;
  createdAt: string;
}

export interface PackerSession {
  id: string;
  batchTitle: string;
  totalResi: number;
  totalQty: number;
  scannedOutCount: number;
  status: 'ACTIVE' | 'COMPLETED';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type ActivityType = 'INBOUND' | 'OUTBOUND' | 'SCAN_PACKER' | 'MASTER_DATA';

export interface ActivityLog {
  id: string;
  type: ActivityType;
  sku?: string;
  productName?: string;
  quantity?: number;
  details: string;
  user: string;
  createdAt: string;
}

export type StockFilter = 'ALL' | 'SAFE' | 'LOW' | 'OUT_OF_STOCK';

export type ProductSortOption =
  | 'SKU_ASC'
  | 'SKU_DESC'
  | 'NAME_ASC'
  | 'NAME_DESC'
  | 'STOCK_DESC'
  | 'STOCK_ASC';

export type DateFilterPreset = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | '3_MONTHS' | 'YEAR' | 'CUSTOM';
