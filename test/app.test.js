import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { zipSync } from 'fflate';
import { build } from '../src/server.js';

// Minimal valid GLB header (12 bytes) is enough: we serve bytes, not parse them.
const glb = Buffer.from('glTF\x02\0\0\0\x0c\0\0\0', 'latin1');
const auth = { authorization: 'Basic ' + Buffer.from('admin:secret').toString('base64') };

function multipart(fields, files) {
  const b = 'XBOUNDARY';
  const parts = [];
  for (const [k, v] of Object.entries(fields)) parts.push(`--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`);
  for (const f of files) parts.push(Buffer.concat([Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${f.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`), f.data, Buffer.from('\r\n')]));
  parts.push(`--${b}--\r\n`);
  return { payload: Buffer.concat(parts.map((p) => Buffer.from(p))), headers: { ...auth, 'content-type': `multipart/form-data; boundary=${b}` } };
}

test('upload zip → embed page, files, auth, delete', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), '3d-'));
  const { app } = await build({ dataDir: dir, adminPassword: 'secret', publicUrl: 'https://3d.test', allowedOrigins: ['https://shop.test'], logger: false });

  assert.equal((await app.inject('/api/models')).statusCode, 401);

  const zip = Buffer.from(zipSync({ 'pack/chair.glb': glb, 'pack/poster.png': Buffer.from('png'), 'pack/chair.usdz': Buffer.from('usdz'), '__MACOSX/x': Buffer.from('x') }));
  const up = await app.inject({ method: 'POST', url: '/api/models', ...multipart({ name: 'Oak Chair' }, [{ name: 'pack.zip', data: zip }]) });
  assert.equal(up.statusCode, 200, up.body);
  const meta = up.json();
  assert.equal(meta.slug, 'oak-chair');
  assert.equal(meta.model, 'chair.glb');
  assert.equal(meta.usdz, 'chair.usdz');
  assert.match(meta.embed, /^<iframe src="https:\/\/3d\.test\/embed\/oak-chair"/);

  const page = await app.inject('/embed/oak-chair');
  assert.equal(page.statusCode, 200);
  assert.match(page.body, /<model-viewer src="\/files\/oak-chair\/chair\.glb"/);
  assert.match(page.headers['content-security-policy'], /frame-ancestors https:\/\/shop\.test/);

  const file = await app.inject('/files/oak-chair/chair.glb');
  assert.equal(file.statusCode, 200);
  assert.equal(file.headers['content-type'], 'model/gltf-binary');
  assert.equal((await app.inject('/files/oak-chair/..%2F..%2Fmeta.json')).statusCode, 404);
  assert.equal((await app.inject('/vendor/model-viewer.min.js')).statusCode, 200);

  const bad = await app.inject({ method: 'POST', url: '/api/models', ...multipart({ name: 'x' }, [{ name: 'a.txt', data: Buffer.from('hi') }]) });
  assert.equal(bad.statusCode, 400);

  assert.equal((await app.inject({ method: 'DELETE', url: '/api/models/oak-chair', headers: auth })).statusCode, 200);
  assert.equal((await app.inject('/embed/oak-chair')).statusCode, 404);
});
