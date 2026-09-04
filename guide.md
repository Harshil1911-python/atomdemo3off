# Atom Bills — Guide

Offline-first POS. Flask + HTML/JS + IndexedDB. PWA. Deploy: GitHub + Render.
Always deliver full project as ZIP.

## IndexedDB (`AtomBills` v3)
products · transactions · held · purchases · finance · suppliers · coupons · parties · quotations · pricelists · inventoryLogs

## Atom Search Dropdown
Search input + dropdown **only after the user types** (matched results only — never dump full list on focus/empty).
Used in: Inventory product pick · Checkout customer select.

## Text POS
Rows: name · tax % · stock qty · price — no images.

## Checkout
1. **Cart** | **Checkout**
2. Select customer + **Cash / Bank-UPI / Unpaid**
3. Subtotal · GST · Discount · Total + coupon
4. Creates bill → invoice PNG preview + Share
5. Syncs sales book, recent TX, proprietor, stock, shift

## Database Excel
- Import products/clients (.xlsx only)
- Checkboxes: **Import and merge** · **Remove all products then import**
- Export products Excel · Export clients Excel

## Render
Build: `pip install -r requirements.txt`  
Start: `gunicorn app:app --bind 0.0.0.0:$PORT`

## Price lists
Per-customer special prices (list name, customer, product, price).

## More actions (+)
Sales return · Purchase return · Received payment · Make payment · Quotation · Expense · Purchase · Parties
All write to IndexedDB and sync stock / books / shift where relevant.
