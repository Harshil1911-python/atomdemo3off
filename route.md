# Routes (SPA)
All routes serve the same single-page app (`index.html`):

`/` `/billing` → Billing panel  
`/calculator` → Calculator panel  
`/proprietor` → Proprietor panel  
`/accountant` → Accountant panel  

Client-side `showPanel()` switches views without full reload. History API keeps URLs shareable.

## Atom Search Dropdown
- Inventory: `#invProdSearch` + `#invProdDrop` (search-required)
- Checkout: `#coCustSearch` + `#coCustDrop` (search-required)
