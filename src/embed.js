const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const enc = (rel) => rel.split('/').map(encodeURIComponent).join('/');

// Standalone viewer page; this is what the Shoptet iframe points at.
export function embedPage(meta, { bg = 'transparent', rotate = true } = {}) {
  const base = `/files/${encodeURIComponent(meta.slug)}/`;
  const attr = (k, v) => (v ? ` ${k}="${esc(v)}"` : '');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(meta.name)} – 3D</title>
<script type="module" src="/vendor/model-viewer.min.js"></script>
<style>
  html,body{margin:0;height:100%;background:${esc(bg)};font-family:system-ui,sans-serif}
  model-viewer{width:100%;height:100%;--poster-color:transparent}
  .hint{position:absolute;left:12px;bottom:14px;font-size:12px;color:#666;pointer-events:none}
</style></head>
<body>
<model-viewer src="${base}${enc(meta.model)}"${attr('ios-src', meta.usdz && base + enc(meta.usdz))}${attr('poster', meta.poster && base + enc(meta.poster))}
  alt="${esc(meta.name)}" camera-controls touch-action="pan-y" ${rotate ? 'auto-rotate' : ''}
  shadow-intensity="1" environment-image="neutral" exposure="1" loading="eager" reveal="auto"
  ar ar-modes="webxr scene-viewer quick-look" ar-scale="auto" ar-placement="floor">
  <button slot="ar-button" id="ar-btn" style="position:absolute;right:12px;bottom:12px;padding:10px 16px;border:0;border-radius:999px;background:#111;color:#fff;font:600 14px system-ui;cursor:pointer">View in your space (AR)</button>
</model-viewer>
<span class="hint">Drag to rotate · pinch to zoom</span>
</body></html>`;
}

export function embedSnippet(publicUrl, slug, { height = 500 } = {}) {
  const src = `${publicUrl.replace(/\/$/, '')}/embed/${encodeURIComponent(slug)}`;
  return `<iframe src="${src}" title="3D model" width="100%" height="${height}" style="border:0;max-width:100%;aspect-ratio:4/3;height:auto;min-height:${height}px" allow="xr-spatial-tracking; fullscreen; autoplay" allowfullscreen loading="lazy"></iframe>`;
}
