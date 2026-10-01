import * as XLSX from 'xlsx';
import { PackerResiItem, Product } from '../types';

/**
 * Format timestamp to WIB time string (HH.mm.ss)
 */
function formatTimeWIB(isoString?: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
  } catch {
    return '-';
  }
}

/**
 * Format full export date Indonesian format
 */
function formatExportDate(): string {
  const d = new Date();
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const pad = (n: number) => n.toString().padStart(2, '0');
  const day = pad(d.getDate());
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const time = `${pad(d.getHours())}.${pad(d.getMinutes())}`;
  return `${day} ${month} ${year} pukul ${time} WIB`;
}

/**
 * Export Scan Packer Report to Excel strictly matching User's specification (Image 1):
 * Header rows: Title, Sheet Name, Export Date & Operator, Total Resi/Qty
 * Columns: NO | JUDUL SHEET | SCAN IN | SCAN OUT | BARCODE SKU | NAMA BARANG | QTY | STATUS | WAKTU SCAN IN | WAKTU SCAN OUT | OPERATOR
 * Summary row: TOT | ...
 */
export function exportPackerExcel(
  items: PackerResiItem[],
  sheetTitle: string,
  operatorName: string = 'RAIA HAIKAL RABBANI'
) {
  if (!items || items.length === 0) {
    console.warn('Tidak ada data scan packer untuk diekspor');
    return;
  }

  const totalQty = items.reduce((acc, i) => acc + i.quantity, 0);
  const scannedOutCount = items.filter((i) => i.isScannedOut).length;
  const pendingCount = items.length - scannedOutCount;
  const uniqueResiCount = new Set(items.map((i) => i.resiNumber)).size;

  // Build 2D Array for worksheet
  const rows: (string | number)[][] = [
    ['PRIANGLAB MANAGEMENT SYSTEM - LAPORAN SCAN PACKER'],
    [`Judul Sheet: ${sheetTitle}`],
    [`Tanggal Export: ${formatExportDate()} | Operator: ${operatorName}`],
    [`Total Resi/Item: ${items.length} | Total QTY Barang: ${totalQty} | Scan Out (Selesai): ${scannedOutCount} | Menunggu Scan Out: ${pendingCount}`],
    [], // empty spacer row
    [
      'NO',
      'JUDUL SHEET',
      'SCAN IN (NO RESI / PESANAN)',
      'SCAN OUT (NO RESI / PESANAN)',
      'BARCODE SKU',
      'NAMA BARANG',
      'QTY',
      'STATUS',
      'WAKTU SCAN IN',
      'WAKTU SCAN OUT',
      'OPERATOR',
    ],
  ];

  // Populate data rows
  items.forEach((item, index) => {
    rows.push([
      index + 1,
      item.sheetTitle || sheetTitle,
      item.resiNumber,
      item.isScannedOut ? item.resiNumber : '-',
      item.sku,
      item.productName,
      item.quantity,
      item.isScannedOut ? 'SELESAI (SCAN OUT)' : 'MENUNGGU SCAN OUT',
      formatTimeWIB(item.createdAt),
      item.isScannedOut && item.scannedOutAt ? formatTimeWIB(item.scannedOutAt) : '-',
      item.scannedBy || operatorName,
    ]);
  });

  // Summary Footer Row (TOT) matching Image 1
  rows.push([
    'TOT',
    '',
    `${uniqueResiCount} Resi`,
    `${scannedOutCount} Scan Out`,
    '',
    '',
    totalQty,
    pendingCount === 0 ? 'SEMUA SELESAI' : `${scannedOutCount}/${items.length} SELESAI`,
    '',
    '',
    '',
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths for clean readability
  worksheet['!cols'] = [
    { wch: 6 },  // NO
    { wch: 24 }, // JUDUL SHEET
    { wch: 28 }, // SCAN IN
    { wch: 28 }, // SCAN OUT
    { wch: 16 }, // BARCODE SKU
    { wch: 36 }, // NAMA BARANG
    { wch: 8 },  // QTY
    { wch: 22 }, // STATUS
    { wch: 16 }, // WAKTU SCAN IN
    { wch: 16 }, // WAKTU SCAN OUT
    { wch: 24 }, // OPERATOR
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Scan Packer');

  const cleanTitle = sheetTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Laporan_Scan_Packer_${cleanTitle}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

/**
 * Export Master Data to Excel sorted alphabetically by SKU (A-Z)
 */
export function exportMasterDataExcel(products: Product[]) {
  if (!products || products.length === 0) {
    alert('Tidak ada data barang untuk diekspor!');
    return;
  }

  // Sort alphabetically by SKU (A-Z)
  const sorted = [...products].sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }));

  const data = sorted.map((p, idx) => ({
    NO: idx + 1,
    'KODE SKU': p.sku,
    'NAMA BARANG': p.name,
    'NOMOR BARCODE': p.barcode,
    'LOKASI RAK / BIN': p.binLocation,
    SATUAN: p.unit,
    'STOK FISIK': p.availableStock,
    'MIN STOK': p.minStock,
    'STATUS STOK':
      p.availableStock === 0
        ? 'HABIS'
        : p.availableStock <= p.minStock
        ? 'MENIPIS'
        : 'AMAN',
    'TERAKHIR DIUBAH': new Date(p.updatedAt).toLocaleString('id-ID'),
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 38 },
    { wch: 20 },
    { wch: 18 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 22 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Data Barang');

  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `PriangLab_MasterData_Barang_${timestamp}.xlsx`);
}

/**
 * Export Master Data to CSV sorted alphabetically by SKU (A-Z)
 */
export function exportMasterDataCSV(products: Product[]) {
  if (!products || products.length === 0) {
    console.warn('Tidak ada data barang untuk diekspor');
    return;
  }

  // Sort alphabetically by SKU (A-Z)
  const sorted = [...products].sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }));

  const data = sorted.map((p, idx) => ({
    NO: idx + 1,
    SKU: p.sku,
    'Nama Barang': p.name,
    Barcode: p.barcode,
    'Lokasi Rak': p.binLocation,
    Satuan: p.unit,
    'Stok Fisik': p.availableStock,
    'Min Stok': p.minStock,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(worksheet);

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `PriangLab_MasterData_SKU_A-Z_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generic CSV exporter
 */
export function exportToCSV<T extends Record<string, unknown>>(data: T[], filenamePrefix: string) {
  if (!data || data.length === 0) {
    console.warn('Tidak ada data untuk diekspor');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(worksheet);

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generic Excel exporter
 */
export function exportToExcel<T extends Record<string, unknown>>(data: T[], filenamePrefix: string) {
  if (!data || data.length === 0) {
    console.warn('Tidak ada data untuk diekspor');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  XLSX.writeFile(workbook, `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
