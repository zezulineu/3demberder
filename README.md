# 3demberder

Self-hosted 3D + AR product viewer for Shoptet shops (RUSCONA, GLAMORA). Upload a 3D package once, copy the generated
`<iframe>` embed code, paste it into the product description (HTML mode). Visitors can rotate/zoom the model and, on
phones, place it in their room (Android Scene Viewer / WebXR, iOS AR Quick Look).

Built on Google's [`<model-viewer>`](https://modelviewer.dev), Fastify, and plain files on disk (no database).

## Why an iframe
Shoptet strips `<script>` tags from product descriptions but keeps `<iframe>`. The iframe loads `/embed/<slug>` from this
app, so the viewer code lives here and can be updated without touching any product.

## Run locally
```bash
cp .env.example .env   # set ADMIN_PASSWORD
npm install
npm run dev            # http://localhost:3000/admin  (user: admin)
npm test
```

## Package format
Upload a `.zip` (or loose files) containing:
- **`.glb`** (recommended) or `.gltf` + its `.bin`/textures – required
- **`.usdz`** – optional; iPhones generate AR from the GLB automatically, supply one only for hand-tuned iOS AR
- **image named `poster*`/`preview*`** – optional; shown while the model loads

Re-uploading with the same slug replaces the model; embed codes stay valid.

## Deploy on the Hostinger VPS (Docker)
```bash
git clone <repo> && cd 3demberder
cp .env.example .env && nano .env     # DOMAIN, PUBLIC_URL, ADMIN_PASSWORD, ALLOWED_ORIGINS
docker compose up -d --build
```
Point a DNS A record for `DOMAIN` (e.g. `3d.yourbrand.com`) at the VPS first; Caddy gets the HTTPS certificate
automatically (HTTPS is required for AR). Models live in `./data` – back that folder up.
Update: `git pull && docker compose up -d --build`.

## Security notes
- `/admin` and `/api/*` are protected by HTTP basic auth (`ADMIN_PASSWORD`); use a long random one.
- The viewer may only be framed by `ALLOWED_ORIGINS` (CSP `frame-ancestors`).

## AR checklist (test on real phones)
AR can't be verified in a desktop browser. Test one product on: Android Chrome, iPhone Safari. If AR inside the
Shoptet iframe misbehaves on some device, the fallback is a plain link/button to `/embed/<slug>` opened in a new tab.

## Hands-off deploys (VPS with host-level nginx)
One-time: add DNS `3d` A record → VPS IP, then on the VPS as root:
```bash
curl -fsSL https://raw.githubusercontent.com/zezulineu/3demberder/main/deploy/bootstrap.sh | bash
```
It installs Docker if missing, starts the app plus Watchtower, adds an nginx server block and an HTTPS certificate.
After that every merge to `main` builds `ghcr.io/zezulineu/3demberder:latest` (GitHub Actions) and Watchtower
rolls it out within ~2 minutes. Make the GHCR package public once (GitHub → Packages → Package settings).
