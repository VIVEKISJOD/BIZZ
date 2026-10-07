# Bizz

Mobile-first, 100% local web app for customer orders, outsourcing and UPI/WhatsApp billing. No server, no cloud sync.

## Deploy (GitHub Pages)
1. Upload all 6 files to a GitHub repo (root folder).
2. Settings → Pages → Deploy from branch → `main` / root.
3. Open the Pages link. Use browser menu → "Add to Home screen" to install.

## Features
- Orders: customer, pickup / expected / actual return / payment dates, total, advance, auto balance due, Cash/UPI.
- Status flow: Picked → Sent → Received → Delivered.
- Bill view with dynamic UPI QR for the due amount, and "Save & WhatsApp" itemized bill.
- Vendors, standard rates (customer rate vs outsource cost), per-job profit.
- Categories → vendors → ledger (revenue, cost, history).
- Settings: shop name, UPI ID, theme, optional 4-digit PIN (off by default), JSON export/import.

## Notes
- Data lives in this browser's localStorage. Export backups regularly.
- The PIN is a casual privacy lock, not strong encryption.
- QR supports up to ~130 characters of payment text; keep shop name short.
