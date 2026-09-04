# Atom Bills — Fixes (strict)

1) Atom Search Dropdown shows results **only when query is non-empty** (inventory + customers).

2) Text POS: no images; name, tax, qty, price.

3) Database: Excel only; merge / replace-all checkboxes; export products & clients Excel.

4) Checkout customer step: Subtotal, GST, Discount, Total + coupon apply.

5) **No PWA loader / top progress feel** — Google Fonts removed (system fonts), SW v22, more aggressive pre-cache + tiny fade-in, black body background to kill white flash, all known loaders forced hidden.

6) Scan beep mp3; torch when supported.

7) Always ZIP; bump SW version.

8) Block long-press/context menu (native PWA feel); no browser image save popup.

9) Expiring stock = products with expiry within next 30 days only.

10) Checkout creates paid transaction → recent TX, sales book, proprietor overview/logs; stock + inventoryLogs updated; shift totals if open.

11) Excel export uses system share sheet when available.

12) Consistent apple-mobile-web-app meta + theme-color #000 on all panels.

13) **Single-page PWA** — all panels in one `index.html`; client-side panel switch; SW spa-v23.
