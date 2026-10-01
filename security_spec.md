# Security Specification: PriangLab Management System

## Data Invariants
1. A Product must have valid sku, name, barcode, and positive or zero stock numbers.
2. An InboundTransaction must have positive quantity and valid SKU.
3. An OutboundTransaction must have positive quantity and cannot deduct below 0 stock.
4. An ActivityLog must be write-once audit log with valid timestamp and user.
5. A PackerSession tracks batch packing states (ACTIVE, COMPLETED).
6. PackerResiItem connects resiNumber with sku and tracked scannedOut status.

## Access Control
- Read access is available for verified users and staff/viewers to access inventory, sheets, and logs.
- Super Admin (`19250781@bsi.ac.id`) has full master data write access.
- Inbound and Outbound writes are permitted for authenticated staff.
- Offline-first: If unauthenticated or offline, the application falls back safely to Local Storage with full data parity.
