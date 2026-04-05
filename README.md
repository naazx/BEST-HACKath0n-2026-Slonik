# BEST-HACKath0n-2026-Slonik
Repository for BEST::HACKath0n 2026 project by team "slonik"

## Deployment notes

### Frontend on Vercel

- This repo is a Vite SPA. Vercel must run `npm run build` and serve `dist`.
- The checked-in [vercel.json](C:/BESTHACK/vercel.json) now pins those settings and keeps SPA routes working.
- Set `VITE_API_BASE` in Vercel to your Render backend URL, for example `https://your-api.onrender.com`.

### Backend on Render

- Deploy the ASP.NET app from [backend/Fulogi/Fulogi.csproj](C:/BESTHACK/backend/Fulogi/Fulogi.csproj).
- Set `Cors__AllowedOrigins` to your Vercel site origin, for example `https://your-app.vercel.app`.
- You can provide multiple origins as a comma-separated list.

### Why production was failing

- Local development worked because Vite proxied `/api/*` to `http://localhost:5064` from [vite.config.ts](C:/BESTHACK/vite.config.ts).
- In production that proxy does not exist, so missing `VITE_API_BASE` makes the browser call the Vercel frontend domain instead, which returns `404` for `/api/Station`, `/api/Storage`, and the other API routes.
- If Vercel serves the raw repo instead of the Vite build, the browser will load source files like `/src/main.tsx` directly and can fail with syntax errors such as `Unexpected token 'export'`.
