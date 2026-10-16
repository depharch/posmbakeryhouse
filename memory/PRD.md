# Housebakery POS PRD

## Original problem statement
Membuat file HTML, CSS, JavaScript untuk mesin kasir Housebakery dengan login admin/admin, POS untuk dine in/take away/shopeefood/gofood/grabfood/voucher, pembayaran, produk tersimpan, KDS, transaksi CSV, laporan penjualan berdasarkan tanggal, dan setting produk baru serta sync.

## Architecture decisions
- React frontend, FastAPI backend, MongoDB persistence.
- JWT session with admin credentials from backend environment.
- Products and orders are stored as separate MongoDB collections.
- CSV is generated from stored orders and downloaded from the transactions view.

## User personas
- Kasir Housebakery: creates orders, collects payment, and sends orders to KDS.
- Supervisor/admin: manages products, reviews transactions and date-filtered reports.
- Kitchen staff: views new tickets in KDS and marks them done.

## Core requirements (static)
- Login admin/admin.
- Create reusable products with name and price.
- Build orders with customer, channel, product quantities, total, and payment validation.
- Payment methods: cash/QRIS for dine in/take away; channel payment for delivery apps.
- Success confirmation, KDS done flow, CSV export, sales report.

## Implemented — 2026-03-02
- Built minimalist brown, cream, and white Housebakery POS interface.
- Added authenticated POS, product catalog, payment modal, success state, KDS, transactions, report, and settings screens.
- Added FastAPI endpoints and MongoDB persistence for products/orders.

## Prioritized backlog
- P0: Confirm end-to-end login, order creation, KDS completion, CSV download, and report filtering.
- P1: Add order cancellation and receipt printing.
- P2: Add staff accounts and product categories.

## Next tasks
- Validate with representative bakery menu data.
- Add optional receipt preview before printing.