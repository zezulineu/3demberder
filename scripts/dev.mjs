// Local development: no .env needed. Starts the app on http://localhost:3000 with a demo model.
process.env.ADMIN_PASSWORD ??= 'dev';
process.env.PUBLIC_URL ??= 'http://localhost:3000';
process.env.ALLOWED_ORIGINS ??= '';   // empty = viewer may be framed anywhere (needed for the preview page)

const { build } = await import('../src/server.js');
const { demoGlb } = await import('./demo-glb.mjs');
const { app, cfg, store } = await build({ logger: false });

if (!(await store.list()).length) {
  await store.save({ slug: 'demo', name: 'Demo panel', files: [{ name: 'demo.glb', data: demoGlb([0.3, 0.05, 0.15]) }], dims: { w: 600, h: 100, d: 300 } });
}
await app.listen({ port: cfg.port, host: '127.0.0.1' });
const u = `http://localhost:${cfg.port}`;
console.log(`\n  3demberder running (auto-restarts when you edit src/)\n
  Preview   ${u}/preview/demo     <- viewer inside a fake product page, desktop / phone widths
  Viewer    ${u}/embed/demo?lang=cs
  Admin     ${u}/admin            user: admin  password: dev\n`);
