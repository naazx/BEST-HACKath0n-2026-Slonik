# BEST-HACKath0n-2026-Slonik
Repository for BEST::HACKath0n 2026 project by team "slonik"

---

<div align="center">

**Fuel delivery management** · React + Vite · ASP.NET Core · SQLite

**Live:** [https://best-hac-kath0n-2026-slonik.vercel.app](https://best-hac-kath0n-2026-slonik.vercel.app) *(Vercel)*

</div>

---

## Contents

| Section | Description |
|--------|-------------|
| **Live site** | [best-hac-kath0n-2026-slonik.vercel.app](https://best-hac-kath0n-2026-slonik.vercel.app) |
| [Quick start](#quick-start) | Run backend and frontend in a few commands |
| [Using the app](#using-the-app) | What each screen and button does |
| [Configuration](#configuration) | API URL, proxy, database |
| [Project layout](#project-layout) | Where the main pieces live |

---

## Quick start

### Prerequisites

- **Node.js** (for the frontend; `npm` or `pnpm`)
- **.NET SDK** matching the backend target (see `backend/Fulogi/*.csproj`)

### 1 · Backend API

```bash
cd backend/Fulogi
dotnet run
```

By default the HTTP URL is **`http://localhost:5064`** (see `Properties/launchSettings.json`). Swagger UI is available while the API is running.

The app creates / uses a **SQLite** database under the `data/` folder (relative to the backend layout).

### 2 · Frontend

In another terminal, from the **repository root**:

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually **`http://localhost:5173`**).  
During development, requests to **`/api/...`** are **proxied** to `http://localhost:5064` (see `vite.config.ts`), so you normally do not need CORS tweaks for local use.

### 3 · Production build (frontend only)

```bash
npm run build
```

Output is written to `dist/`. Serve those static files behind your web server; set **`VITE_API_BASE`** to your public API origin if the UI is not on the same host as the API (see [Configuration](#configuration)).

---

## Using the app

> Short guide to the UI — **behavior matches the connected API**; this is a workflow description, not a spec of server rules.

### Main screen

| Area | Purpose |
|------|---------|
| **Requests** | Lists fuel requests in the order returned by **`GET /api/FuelRequest/sorted-by-priority-and-status`**. |
| **Storage facilities** | All storages; edit or delete from the row actions. |
| **Stations** | All stations; edit or delete from the row actions. |

### Header actions

| Button | Effect |
|--------|--------|
| **New station** | Opens a form: name, latitude, longitude → creates a station via the API. |
| **New storage** | Opens a form: name, coordinates, fuel available → creates a storage. |
| **New request** | Opens a form: destination station, priority, fuel amount → creates a **pending** request (requires at least one station and one storage). |

### Request card

Click a request to open **Request details**.

### Request details (by status)

| Status (UI) | What you can do |
|-------------|------------------|
| **Pending** | Change **priority** (saved immediately), edit **fuel amount** (saved when the field **loses focus**), choose **delivering storage**, then **Confirm dispatch** (creates a delivery and moves the request to **in process**). |
| **In process** | **Mark as delivered** — completes the request, updates the delivery, and reduces the storage’s available fuel. |
| **Delivered** | Read-only; shows that the delivery is complete. |

### Tips

- Start with **storages** and **stations**, then **requests**, so dropdowns and routes have data to work with.
- If something fails, the UI surfaces errors with a browser alert; check that the backend is running and the dev proxy (or `VITE_API_BASE`) is correct.

---

## Configuration

| Variable | When to set | Role |
|----------|-------------|------|
| `VITE_API_BASE` | Production or when **not** using the Vite dev proxy | Full base URL of the API (no trailing slash), e.g. `https://api.example.com`. If unset, the frontend uses relative **`/api`** (works with the Vite proxy in dev). |

---

## Project layout

```
.
├── backend/Fulogi/          # ASP.NET Core API (controllers, Program.cs, SQLite path)
├── src/
│   ├── api/fulogiApi.ts     # HTTP client & DTO helpers
│   ├── app/App.tsx          # Main UI
│   └── ...
├── vite.config.ts           # Dev server + /api proxy
└── README.md
```

---

## API ↔ UI mapping (reference)

Backend enums use names like **`await` / `inProgress` / `done`** and **`low` / `medium` / `high`** (JSON camelCase). The UI maps these to labels such as *Pending*, *In process*, and *Delivered* for display only.

---

<p align="center">
  <sub>BEST::HACKath0n 2026 · Team Slonik</sub>
</p>
