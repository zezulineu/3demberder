# 3demberder – agent notes
Node 22, ESM, Fastify. No build step, no DB (files in DATA_DIR/models/<slug>/{meta.json,files/}).
- `src/store.js` upload handling (zip expansion, path-safety, file classification)
- `src/embed.js` viewer HTML + iframe snippet; `src/server.js` routes/auth/CSP; `public/admin.html` admin UI
- Run `npm test` before committing. Keep dependencies minimal.
