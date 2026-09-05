# Atom Bills — Guide

Offline-first POS. Flask + HTML/JS + IndexedDB. PWA. Deploy: GitHub + Render.
Always deliver full project as ZIP.

## IndexedDB (`AtomBills` v5) — strict stores

- products
- categories
- customers
- suppliers
- sales
- saleItems
- purchases
- purchaseItems
- payments
- expenses
- stockMovements
- returns
- heldBills
- users
- settings
- auditLogs
- coupons
- quotations
- pricelists

Legacy aliases (auto-mapped): transactions→sales, parties→customers, held→heldBills, inventoryLogs→stockMovements, finance→expenses, meta→settings.

## Hamburger menu
- Offline-ready badge only
- Change Panel (Proprietor / Billing / Accountant)
- No Sync / Update
- No Install for offline use (use browser PWA install)

## Accountant
Book tabs: P&L · Sales · Purchase · Sales Return · Purchase Return · GSTR-1 · Tax summary · Day book

## Atom Search Dropdown
Search input + dropdown **only after the user types**.

## Checkout
Creates sale in IndexedDB (sales store) → stockMovements · proprietor stats.

## Database
Export / import full IndexedDB dump (v5 schema). Excel import/export products & clients.

## Render
Build: `pip install -r requirements.txt`  
Start: `gunicorn app:app --bind 0.0.0.0:$PORT`
