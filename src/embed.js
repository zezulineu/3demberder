const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const enc = (rel) => rel.split('/').map(encodeURIComponent).join('/');

export const LANGS = ['cs', 'de', 'en'];

const T = {
  cs: { hint: 'Táhni pro otočení', left: 'Otočit doleva', right: 'Otočit doprava', play: 'Spustit rotaci', pause: 'Zastavit rotaci', out: 'Oddálit', in: 'Přiblížit', full: 'Celá obrazovka', ar: 'Zobrazit v prostoru (AR)', loading: 'Načítám 3D model…', failed: 'Model se nepodařilo načíst', dimsOn: 'Zobrazit rozměry', dimsOff: 'Skrýt rozměry' },
  de: { hint: 'Zum Drehen ziehen', left: 'Nach links drehen', right: 'Nach rechts drehen', play: 'Rotation starten', pause: 'Rotation stoppen', out: 'Verkleinern', in: 'Vergrößern', full: 'Vollbild', ar: 'In deinem Raum ansehen (AR)', loading: '3D-Modell wird geladen…', failed: 'Modell konnte nicht geladen werden', dimsOn: 'Maße anzeigen', dimsOff: 'Maße ausblenden' },
  en: { hint: 'Drag to rotate', left: 'Rotate left', right: 'Rotate right', play: 'Start rotation', pause: 'Stop rotation', out: 'Zoom out', in: 'Zoom in', full: 'Fullscreen', ar: 'View in your space (AR)', loading: 'Loading 3D model…', failed: 'Could not load the model', dimsOn: 'Show dimensions', dimsOff: 'Hide dimensions' },
};

const icon = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  left: icon('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  right: icon('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>'),
  play: icon('<path d="M7 5v14l12-7z"/>'),
  pause: icon('<path d="M8 5v14M16 5v14"/>'),
  out: icon('<path d="M5 12h14"/>'),
  in: icon('<path d="M5 12h14M12 5v14"/>'),
  dims: icon('<path d="M3 17 17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>'),
  full: icon('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'),
};

export const color = (v, fallback) =>
  /^[0-9a-f]{3,8}$/i.test(v ?? '') ? `#${v}` : /^[a-z]{3,20}$/i.test(v ?? '') ? v : fallback;

// Standalone viewer page; this is what the Shoptet iframe points at.
export function embedPage(meta, { lang = 'cs', bg = '#000', page = '#f2f1ed', rotate = false, dims = false } = {}) {
  const t = T[lang] ?? T.cs;
  const base = `/files/${encodeURIComponent(meta.slug)}/`;
  const attr = (k, v) => (v ? ` ${k}="${esc(v)}"` : '');
  const btn = (id, key, label) =>
    `<button type="button" id="${id}" aria-label="${esc(label)}" title="${esc(label)}">${ICONS[key]}</button>`;
  return `<!doctype html>
<html lang="${esc(lang)}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<link rel="icon" href="data:,">
<title>${esc(meta.name)} – 3D</title>
<script type="module" src="/vendor/model-viewer.min.js"></script>
<style>
  html,body{margin:0;height:100%;background:${esc(page)};font-family:system-ui,sans-serif}
  body{display:flex;flex-direction:column}
  .stage{position:relative;flex:1;min-height:0;background:${esc(bg)}}
  model-viewer{width:100%;height:100%;--poster-color:transparent;--progress-bar-color:transparent}
  .hint{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);padding:12px 26px;border-radius:999px;
    background:rgba(232,232,232,.92);color:#555;font:500 15px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;
    text-transform:uppercase;white-space:nowrap;pointer-events:none;transition:opacity .4s}
  .hint.gone{opacity:0}
  .loader{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
    pointer-events:none;transition:opacity .3s;font:500 14px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;color:#fff}
  .loader .card{display:flex;flex-direction:column;align-items:center;gap:12px;padding:18px 26px;border-radius:16px;background:rgba(0,0,0,.6)}
  .loader .track{width:200px;height:4px;border-radius:4px;background:rgba(255,255,255,.25);overflow:hidden}
  .loader .fill{height:100%;width:0;background:#fff;border-radius:4px;transition:width .2s}
  .loader.done{opacity:0}.loader.err .track{display:none}
  .bar.busy button{opacity:.35;pointer-events:none}
  .bar{--gap:clamp(6px,2.2vw,16px);display:flex;justify-content:center;gap:var(--gap);padding:16px 8px 20px}
  .bar button{width:min(56px,calc((100vw - 16px - 6 * var(--gap)) / 7));aspect-ratio:1;border-radius:50%;border:1px solid #e3e1dc;background:#fff;color:#111;display:grid;place-items:center;
    cursor:pointer;box-shadow:0 6px 16px rgba(0,0,0,.09);transition:transform .1s,opacity .2s;-webkit-tap-highlight-color:transparent}
  .bar button[aria-pressed=true]{background:#111;color:#fff;border-color:#111}
  .bar button:active:not(:disabled){transform:scale(.94)}
  .bar button:disabled{opacity:.35;cursor:default;box-shadow:none;background:#f7f6f3}
  .bar button:focus-visible{outline:2px solid #111;outline-offset:2px}
  .ar{position:absolute;right:12px;top:12px;padding:10px 16px;border:0;border-radius:999px;background:#fff;color:#111;
    font:600 14px system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.25)}
  .dims{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .25s}
  .dims.on{opacity:1}
  .dims svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 2px rgba(0,0,0,.95))}
  .dims line{stroke:#fff;stroke-width:1.6;stroke-linecap:round}
  .dims .dot{stroke:none;fill:#fff}
  .dims .lbl{position:absolute;transform:translate(-50%,-50%);padding:4px 10px;border-radius:999px;background:rgba(0,0,0,.78);color:#fff;
    font:600 13px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;box-shadow:0 0 0 1px rgba(255,255,255,.35)}
  .dp{display:block;width:6px;height:6px;pointer-events:none;opacity:0}
  @media (max-width:420px){.hint{font-size:12px;padding:10px 18px}.dims .lbl{font-size:11px;padding:3px 8px}}
</style></head>
<body>
<div class="stage">
  <model-viewer id="mv" src="${base}${enc(meta.model)}"${attr('ios-src', meta.usdz && base + enc(meta.usdz))}${attr('poster', meta.poster && base + enc(meta.poster))}
    alt="${esc(meta.name)}" camera-controls touch-action="pan-y" auto-rotate-delay="0" rotation-per-second="18deg" ${rotate ? 'auto-rotate' : ''}
    shadow-intensity="1" environment-image="neutral" exposure="1" loading="eager" reveal="auto" interaction-prompt="none"
    ar ar-modes="webxr scene-viewer quick-look" ar-scale="auto" ar-placement="floor">
    <button slot="ar-button" class="ar">${esc(t.ar)}</button>
    <span class="dp" slot="hotspot-d0"></span><span class="dp" slot="hotspot-d1"></span><span class="dp" slot="hotspot-d2"></span><span class="dp" slot="hotspot-d3"></span><span class="dp" slot="hotspot-d4"></span>
  </model-viewer>
  <div class="dims" id="dims" aria-hidden="true"><svg><line id="l0"/><line id="l1"/><line id="l2"/></svg>
    <span class="lbl" id="b0"></span><span class="lbl" id="b1"></span><span class="lbl" id="b2"></span></div>
  <div class="hint gone" id="hint">${esc(t.hint)}</div>
  <div class="loader" id="loader" role="status" aria-live="polite"><div class="card"><span id="ltext">${esc(t.loading)} 0 %</span><div class="track"><div class="fill" id="lfill"></div></div></div></div>
</div>
<div class="bar busy" id="bar">
  ${btn('left', 'left', t.left)}${btn('right', 'right', t.right)}${btn('play', rotate ? 'pause' : 'play', rotate ? t.pause : t.play)}
  ${btn('out', 'out', t.out)}${btn('in', 'in', t.in)}${btn('dims-btn', 'dims', t.dimsOn).replace('<button ', '<button aria-pressed="false" ')}${btn('full', 'full', t.full)}
</div>
<script>
const T=${JSON.stringify(t)},ICONS=${JSON.stringify({ play: ICONS.play, pause: ICONS.pause })},LANG=${JSON.stringify(lang)},DIMS=${JSON.stringify(meta.dims ?? null)},DIMS_START=${dims ? 'true' : 'false'};
const mv=document.getElementById('mv'),$=id=>document.getElementById(id);
let r0=0,rMin=0;
const S={th:0,ph:0,r:0};            // camera target; buttons edit it, so quick repeated clicks add up
const read=()=>{const o=mv.getCameraOrbit();S.th=o.theta;S.ph=o.phi;S.r=o.radius};
const apply=()=>{mv.cameraOrbit=S.th+'rad '+S.ph+'rad '+S.r+'m';sync()};
const sync=()=>{if(!r0)return;$('out').disabled=S.r>=r0*0.995;$('in').disabled=S.r<=rMin*1.005};
let touched=false;
mv.addEventListener('progress',e=>{const p=Math.round((e.detail.totalProgress||0)*100);
  $('lfill').style.width=p+'%';$('ltext').textContent=T.loading+' '+p+' %'});
mv.addEventListener('error',()=>{$('loader').classList.add('err');$('ltext').textContent=T.failed});
mv.addEventListener('load',()=>{
  $('loader').classList.add('done');$('bar').classList.remove('busy');if(!touched)$('hint').classList.remove('gone');
  read();r0=S.r;rMin=r0*0.35;
  mv.minCameraOrbit='auto auto '+rMin+'m';mv.maxCameraOrbit='auto auto '+r0+'m';sync();
});
mv.addEventListener('camera-change',e=>{if(e.detail&&e.detail.source==='user-interaction'){read();sync()}});
$('left').onclick=()=>{if(mv.hasAttribute('auto-rotate'))read();S.th-=Math.PI/4;apply()};
$('right').onclick=()=>{if(mv.hasAttribute('auto-rotate'))read();S.th+=Math.PI/4;apply()};
$('in').onclick=()=>{S.r=Math.max(rMin,S.r*0.75);apply()};
$('out').onclick=()=>{S.r=Math.min(r0,S.r/0.75);apply()};
$('play').onclick=()=>{
  const on=mv.hasAttribute('auto-rotate');
  if(on)mv.removeAttribute('auto-rotate');else mv.setAttribute('auto-rotate','');
  $('play').innerHTML=ICONS[on?'play':'pause'];
  $('play').title=$('play').ariaLabel=on?T.play:T.pause;
};
if(document.fullscreenEnabled||document.webkitFullscreenEnabled){
  $('full').onclick=()=>{const d=document,el=d.documentElement;
    if(d.fullscreenElement||d.webkitFullscreenElement)(d.exitFullscreen||d.webkitExitFullscreen).call(d);
    else(el.requestFullscreen||el.webkitRequestFullscreen).call(el)};
}else $('full').style.display='none';
// --- dimensions overlay -----------------------------------------------------------------------------------------
// Hotspots sit on corners of the model's bounding box; three lines (width, height, depth) are drawn between them:
// width along the front-bottom edge, height up the right-front edge, depth along the left-bottom edge, so the labels
// land on different sides of the product. Labels show the exact values entered in the admin (mm); without them the
// size measured from the model (metres) is used.
let dimsOn=false,raf=0,pts=null;
const nf=new Intl.NumberFormat(LANG,{maximumFractionDigits:1});
const fmt=mm=>mm>=10?nf.format(mm/10)+' cm':nf.format(mm)+' mm';
const setupDims=()=>{
  const c=mv.getBoundingBoxCenter(),d=mv.getDimensions(),x=d.x/2,y=d.y/2,z=d.z/2;
  const P=[[c.x-x,c.y-y,c.z+z],[c.x+x,c.y-y,c.z+z],[c.x+x,c.y+y,c.z+z],[c.x-x,c.y-y,c.z-z],[c.x,c.y,c.z]];
  P.forEach((p,i)=>mv.updateHotspot({name:'hotspot-d'+i,position:p.join(' ')}));
  const mm=DIMS?[DIMS.w,DIMS.h,DIMS.d]:[d.x*1000,d.y*1000,d.z*1000];
  pts=[[0,1,mm[0]],[1,2,mm[1]],[3,0,mm[2]]];   // width (P0-P1), height (P1-P2), depth (P3-P0)
  pts.forEach((l,i)=>$('b'+i).textContent=fmt(l[2]));
};
const drawDims=()=>{
  if(!dimsOn)return;
  const cp=i=>{const h=mv.queryHotspot('hotspot-d'+i);return h&&h.canvasPosition};
  const C=cp(4),W=mv.clientWidth,H=mv.clientHeight,pos=[];
  if(C)pts.forEach((l,i)=>{const a=cp(l[0]),b=cp(l[1]);if(!a||!b)return;
    const ln=$('l'+i);ln.setAttribute('x1',a.x);ln.setAttribute('y1',a.y);ln.setAttribute('x2',b.x);ln.setAttribute('y2',b.y);
    // label sits just outside the model: push it away from the model centre by half its own size
    const lb=$('b'+i),w=lb.offsetWidth,h=lb.offsetHeight,mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    let dx=mx-C.x,dy=my-C.y;const n=Math.hypot(dx,dy)||1;dx/=n;dy/=n;
    const e=Math.abs(dx)*w/2+Math.abs(dy)*h/2+10;
    pos[i]={x:mx+dx*e,y:my+dy*e,w,h}});
  for(let k=0;k<3;k++)for(let i=0;i<pos.length;i++)for(let j=i+1;j<pos.length;j++){   // nudge overlapping labels apart
    const p=pos[i],q=pos[j];if(!p||!q)continue;
    const ox=(p.w+q.w)/2+4-Math.abs(p.x-q.x),oy=(p.h+q.h)/2+2-Math.abs(p.y-q.y);
    if(ox>0&&oy>0){const s=(p.y<=q.y?1:-1)*oy/2;p.y-=s;q.y+=s}}
  pos.forEach((p,i)=>{if(!p)return;const lb=$('b'+i);
    lb.style.left=Math.min(W-p.w/2-4,Math.max(p.w/2+4,p.x))+'px';lb.style.top=Math.min(H-p.h/2-4,Math.max(p.h/2+4,p.y))+'px'});
  raf=requestAnimationFrame(drawDims);
};
const showDims=on=>{
  dimsOn=on;if(on&&!pts)setupDims();
  $('dims').classList.toggle('on',on);
  const b=$('dims-btn');b.setAttribute('aria-pressed',on);b.title=b.ariaLabel=on?T.dimsOff:T.dimsOn;
  cancelAnimationFrame(raf);if(on)drawDims();
};
$('dims-btn').onclick=()=>showDims(!dimsOn);
mv.addEventListener('load',()=>{if(DIMS_START)showDims(true)});
mv.addEventListener('pointerdown',()=>{touched=true;$('hint').classList.add('gone')},{once:true});
</script>
</body></html>`;
}

export function embedSnippet(publicUrl, slug, { height = 560, lang = 'cs' } = {}) {
  const src = `${publicUrl.replace(/\/$/, '')}/embed/${encodeURIComponent(slug)}?lang=${lang}`;
  return `<iframe src="${src}" title="3D model" width="100%" height="${height}" style="border:0;max-width:100%;min-height:${height}px" allow="xr-spatial-tracking; fullscreen; autoplay" allowfullscreen loading="lazy"></iframe>`;
}

// Dev/admin helper: shows the exact embed snippet inside a mock Shoptet product page at several widths.
export function previewPage(meta, { snippet }) {
  const snippets = Object.fromEntries(LANGS.map((l) => [l, snippet(l)]));
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Preview – ${esc(meta.name)}</title><link rel="icon" href="data:,">
<style>
  body{margin:0;font:16px/1.6 system-ui,sans-serif;background:#e9e9ee;color:#222}
  .tools{position:sticky;top:0;z-index:2;display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 16px;background:#111;color:#fff}
  .tools b{margin-right:8px}.tools button{padding:6px 12px;border:1px solid #555;border-radius:6px;background:#222;color:#fff;cursor:pointer}
  .tools button.on{background:#fff;color:#111}.tools span{opacity:.6;margin-left:auto;font-size:13px}
  .shop{margin:20px auto;background:#fff;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,.12);transition:width .2s;max-width:100%}
  h1{margin-top:0}.fake{color:#777}
</style></head><body>
<div class="tools"><b>${esc(meta.name)}</b>
  <button data-w="1100" class="on">Desktop</button><button data-w="768">Tablet</button><button data-w="390">Phone</button>
  <b style="margin-left:16px">Lang</b><button data-l="cs" class="on">CZ</button><button data-l="de">DE</button><button data-l="en">EN</button>
  <span>This is the exact embed code pasted into a product description. Edit src/, save, the page reloads on refresh.</span></div>
<div class="shop" id="shop" style="width:1100px">
  <h1>${esc(meta.name)}</h1>
  <p class="fake">Product description text above the 3D model. Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
  <div id="embed"></div>
  <p class="fake">Product description text below the 3D model. Technical parameters, delivery and so on.</p>
</div>
<script>
const S=${JSON.stringify(snippets)};let lang='cs';
const draw=()=>document.getElementById('embed').innerHTML=S[lang];
document.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{document.getElementById('shop').style.width=b.dataset.w+'px';
  document.querySelectorAll('[data-w]').forEach(x=>x.classList.toggle('on',x===b))});
document.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{lang=b.dataset.l;draw();
  document.querySelectorAll('[data-l]').forEach(x=>x.classList.toggle('on',x===b))});
draw();
</script></body></html>`;
}
