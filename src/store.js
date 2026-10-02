import { mkdir, readdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { unzipSync } from 'fflate';

export const MODEL_EXT = ['.glb', '.gltf'];
export const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp'];

export function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// Reject anything that could escape the model directory.
export function safeRelPath(p) {
  const norm = path.posix.normalize(String(p).replace(/\\/g, '/')).replace(/^\/+/, '');
  if (!norm || norm.startsWith('..') || norm.includes('/../')) return null;
  if (norm.split('/').some((seg) => seg.startsWith('.') || seg === '__MACOSX')) return null;
  return norm;
}

// Turn uploads (loose files and/or zip archives) into a flat list of {name, data}.
export function expandUploads(files) {
  const out = [];
  for (const f of files) {
    if (f.name.toLowerCase().endsWith('.zip')) {
      const entries = unzipSync(new Uint8Array(f.data));
      for (const [name, data] of Object.entries(entries)) {
        if (name.endsWith('/')) continue;
        out.push({ name, data: Buffer.from(data) });
      }
    } else {
      out.push(f);
    }
  }
  const cleaned = [];
  for (const f of out) {
    const rel = safeRelPath(f.name);
    if (rel) cleaned.push({ name: rel, data: f.data });
  }
  // If everything sits in one wrapper folder, strip it.
  const first = cleaned[0]?.name.split('/')[0];
  if (cleaned.length > 1 && cleaned.every((f) => f.name.includes('/') && f.name.split('/')[0] === first)) {
    for (const f of cleaned) f.name = f.name.slice(first.length + 1);
  }
  return cleaned;
}

export function classify(files) {
  const ext = (f) => path.posix.extname(f.name).toLowerCase();
  const byDepth = (a, b) => a.name.split('/').length - b.name.split('/').length;
  const glb = files.filter((f) => ext(f) === '.glb').sort(byDepth)[0];
  const gltf = files.filter((f) => ext(f) === '.gltf').sort(byDepth)[0];
  const usdz = files.filter((f) => ext(f) === '.usdz').sort(byDepth)[0];
  const images = files.filter((f) => IMAGE_EXT.includes(ext(f)));
  const poster = images.find((f) => /poster|preview|thumb/i.test(f.name)) ?? (glb && !gltf && images.length === 1 ? images[0] : undefined);
  return { model: glb ?? gltf, usdz, poster };
}

export class Store {
  constructor(dataDir) {
    this.root = path.resolve(dataDir, 'models');
  }
  dir(slug) {
    return path.join(this.root, slug);
  }
  async init() {
    await mkdir(this.root, { recursive: true });
  }
  async list() {
    const out = [];
    for (const slug of await readdir(this.root).catch(() => [])) {
      const m = await this.get(slug);
      if (m) out.push(m);
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async get(slug) {
    try {
      return JSON.parse(await readFile(path.join(this.dir(slug), 'meta.json'), 'utf8'));
    } catch {
      return null;
    }
  }
  async save({ slug, name, sku, files }) {
    const expanded = expandUploads(files);
    const { model, usdz, poster } = classify(expanded);
    if (!model) throw Object.assign(new Error('No .glb or .gltf file found in the upload'), { statusCode: 400 });
    const dir = this.dir(slug);
    const prev = await this.get(slug);
    await rm(path.join(dir, 'files'), { recursive: true, force: true });
    for (const f of expanded) {
      const target = path.join(dir, 'files', f.name);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, f.data);
    }
    const now = new Date().toISOString();
    const meta = {
      slug, name, sku: sku || '',
      model: model.name, usdz: usdz?.name ?? null, poster: poster?.name ?? null,
      createdAt: prev?.createdAt ?? now, updatedAt: now,
    };
    await writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
    return meta;
  }
  async remove(slug) {
    await rm(this.dir(slug), { recursive: true, force: true });
  }
  filePath(slug) {
    return path.join(this.dir(slug), 'files');
  }
  async exists(p) {
    return stat(p).then(() => true, () => false);
  }
}
