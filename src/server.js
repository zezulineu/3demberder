import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store, slugify } from './store.js';
import { embedPage, embedSnippet, previewPage, LANGS, color } from './embed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

export async function build(opts = {}) {
  const cfg = {
    port: Number(process.env.PORT ?? 3000),
    dataDir: process.env.DATA_DIR ?? './data',
    publicUrl: process.env.PUBLIC_URL ?? 'http://localhost:3000',
    adminPassword: process.env.ADMIN_PASSWORD ?? '',
    allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '').split(/\s+/).filter(Boolean),
    maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 150),
    ...opts,
  };
  if (!cfg.adminPassword) throw new Error('ADMIN_PASSWORD is required');

  const store = new Store(cfg.dataDir);
  await store.init();
  const app = Fastify({ logger: opts.logger ?? true, trustProxy: true });
  await app.register(multipart, { limits: { fileSize: cfg.maxUploadMb * 1024 * 1024, files: 200 } });

  const want = Buffer.from(cfg.adminPassword);
  const requireAdmin = async (req, reply) => {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    const pass = scheme === 'Basic' ? Buffer.from(token ?? '', 'base64').toString().split(':').slice(1).join(':') : '';
    const got = Buffer.from(pass);
    if (got.length !== want.length || !timingSafeEqual(got, want)) {
      reply.header('WWW-Authenticate', 'Basic realm="3demberder"').code(401).send('Unauthorized');
    }
  };

  // Only the shop domains may frame the viewer.
  app.addHook('onSend', async (req, reply) => {
    if (req.url.startsWith('/embed/')) {
      const ancestors = cfg.allowedOrigins.length ? cfg.allowedOrigins.join(' ') : '*';
      reply.header('Content-Security-Policy', `frame-ancestors ${ancestors}`);
    } else if (!req.url.startsWith('/files/')) {
      reply.header('X-Frame-Options', 'DENY');
    }
  });

  // --- public ---
  app.get('/healthz', async () => ({ ok: true }));
  app.get('/embed/:slug', async (req, reply) => {
    const meta = await store.get(slugify(req.params.slug));
    if (!meta) return reply.code(404).send('Not found');
    const { bg, page, rotate, lang } = req.query;
    return reply.type('text/html').header('Cache-Control', isProd ? 'public, max-age=60' : 'no-store')
      .send(embedPage(meta, {
        lang: LANGS.includes(lang) ? lang : 'cs',
        bg: color(bg, '#000'),
        page: color(page, '#f2f1ed'),
        rotate: rotate === '1',
      }));
  });
  app.get('/files/:slug/*', async (req, reply) => {
    const slug = slugify(req.params.slug);
    const rel = req.params['*'];
    const root = store.filePath(slug);
    const abs = path.resolve(root, rel);
    if (!abs.startsWith(root + path.sep) || !(await store.exists(abs))) return reply.code(404).send('Not found');
    const types = { '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.usdz': 'model/vnd.usdz+zip' };
    return reply
      .header('Access-Control-Allow-Origin', '*')
      .header('Cache-Control', 'public, max-age=3600')
      .type(types[path.extname(abs).toLowerCase()] ?? 'application/octet-stream')
      .sendFile(rel, root);
  });
  await app.register(fastifyStatic, {
    root: path.resolve(here, '../node_modules/@google/model-viewer/dist'),
    prefix: '/vendor/', decorateReply: true, maxAge: '7d',
  });

  // --- admin ---
  await app.register(async (admin) => {
    admin.addHook('onRequest', requireAdmin);
    admin.get('/admin', async (req, reply) => reply.type('text/html').send(await (await import('node:fs/promises')).readFile(path.join(here, '../public/admin.html'))));
    admin.get('/preview/:slug', async (req, reply) => {
      const meta = await store.get(slugify(req.params.slug));
      if (!meta) return reply.code(404).send('Not found');
      return reply.type('text/html').header('Cache-Control', 'no-store').send(previewPage(meta, { snippet: (lang) => embedSnippet('', meta.slug, { lang }) }));
    });
    admin.get('/api/models', async () => {
      const models = await store.list();
      return models.map((m) => ({ ...m, embed: embedSnippet(cfg.publicUrl, m.slug), url: `${cfg.publicUrl}/embed/${m.slug}` }));
    });
    admin.post('/api/models', async (req, reply) => {
      const fields = {};
      const files = [];
      for await (const part of req.parts()) {
        if (part.type === 'file') files.push({ name: part.filename, data: await part.toBuffer() });
        else fields[part.fieldname] = part.value;
      }
      const name = (fields.name ?? '').trim();
      const slug = slugify(fields.slug || name);
      if (!name || !slug) return reply.code(400).send({ error: 'Name is required' });
      if (!files.length) return reply.code(400).send({ error: 'Attach a .glb/.gltf file or a .zip package' });
      try {
        const meta = await store.save({ slug, name, sku: fields.sku, files });
        return { ...meta, embed: embedSnippet(cfg.publicUrl, slug), url: `${cfg.publicUrl}/embed/${slug}` };
      } catch (e) {
        return reply.code(e.statusCode ?? 400).send({ error: e.message });
      }
    });
    admin.delete('/api/models/:slug', async (req) => {
      await store.remove(slugify(req.params.slug));
      return { ok: true };
    });
  });

  return { app, cfg, store };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { app, cfg } = await build();
  await app.listen({ port: cfg.port, host: '0.0.0.0' });
}
