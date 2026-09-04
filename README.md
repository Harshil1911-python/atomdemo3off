# Atom Bills

Offline-first POS (billing · proprietor · calculator). Flask + HTML/JS + IndexedDB. PWA installable.

## Setup

```bash
cd atom-bills
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Start (development)

```bash
python app.py
```

Opens on `http://0.0.0.0:5000` (use your LAN IP on phone).

## Start (production)

```bash
gunicorn -b 0.0.0.0:5000 app:app
```

## PWA install

1. Open the site in **Chrome** (Android) or **Safari** (iOS) over **HTTPS** or `localhost`.
2. Chrome: menu → **Install app** / **Add to Home screen** (or the in-app Install banner in the side menu).
3. Safari iOS: Share → **Add to Home Screen**.

Camera/scanner needs HTTPS (or localhost).

## Build note

No separate build step — static HTML/JS. Deploy the folder as-is (Render: use `gunicorn -b 0.0.0.0:$PORT app:app`).
