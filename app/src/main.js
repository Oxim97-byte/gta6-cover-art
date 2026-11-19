// Sunset Strip — editor wiring. The rail on the left walks through five steps
// (Photos → Layout → Grade → Caption → Export); the canvas in the middle is the live
// preview. Click a panel to select it, drag inside it to slide its photo, pick a
// thumbnail to put that photo in the selected panel. Every committed change is pushed
// onto an undo stack (Ctrl+Z / Ctrl+Y, plus the buttons). A `?shot=` query hands the
// page to ./shots.js for a fixed screenshot scene instead.
import { drawCover, defaultState, layoutPanels, LAYOUT_IDS, LAYOUT_NAMES, PANEL_COUNTS, LAYOUT_CAPTION_Y } from './cover.js';
import { GRADES, GRADE_IDS } from './grades.js';
import { runShot } from './shots.js';

const SAMPLES = [
  { id: 'rooftop-sunset', name: 'Rooftop Sunset' },
  { id: 'neon-street', name: 'Neon Street' },
  { id: 'boardwalk-skater', name: 'Boardwalk Skater' },
  { id: 'boulevard', name: 'Boulevard' },
  { id: 'pier', name: 'Pier' },
];
const EXPORT_SIZES = [
  { w: 1080, h: 1080, label: '1080 × 1080' },
  { w: 1080, h: 1350, label: '1080 × 1350' },
  { w: 1920, h: 1080, label: '1920 × 1080' },
];

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const $ = (id) => document.getElementById(id);

let state = defaultState();
// photos: [{ kind: 'sample'|'upload', name, src }]; images live in imgCache by src.
let photos = [];
const imgCache = new Map();
let selectedPanel = 0;
let exportSize = EXPORT_SIZES[0];
let history = [];
let hIndex = -1;
let fontsReady = false;
// `shot` mode (?shot=) paints a fixed screenshot scene: no URL state, no dirty flag.
let shotMode = false;
let unsavedChanges = false;
let redrawQueued = false;
let canvasRect = null;
let keyPanMoved = false;

function setStatus(msg) { statusEl.textContent = msg; }

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  if (imgCache.has(url)) return Promise.resolve(imgCache.get(url));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { imgCache.set(url, img); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

function images() {
  return photos.map((p) => imgCache.get(p.src) || null);
}

function redraw() {
  drawCover(canvas, { ...state, images: images() });
  renderPhotoStrip();
  renderPanelBar();
}

// Coalesce rapid repaints (typing, dragging, arrow-key pans) to one per frame
// instead of a full canvas repaint per keystroke / pointermove.
function redrawSoon() {
  if (redrawQueued) return;
  redrawQueued = true;
  requestAnimationFrame(() => { redrawQueued = false; redraw(); });
}

// Plain-language description of the poster as it currently stands, for the
// canvas role="img" label: layout, grade, photos, caption, selected panel.
function describeCover() {
  const count = PANEL_COUNTS[state.layout];
  const photoIdx = state.panelPhoto[selectedPanel];
  const photo = photos[photoIdx];
  const parts = [
    `Cover preview, ${LAYOUT_NAMES[state.layout]} layout, ${GRADES[state.grade].name} grade, ${count} panel${count === 1 ? '' : 's'}`,
    state.caption ? `title “${state.caption}”` : 'no title',
    state.subtitle ? `subtitle “${state.subtitle}”` : null,
    state.heat ? `${state.heat} of 5 heat stars` : null,
    `panel ${selectedPanel + 1} of ${count} selected${photo ? `, photo ${photo.name}` : ''}`,
    'Use arrow keys to slide the selected panel photo, number keys to switch panels',
  ].filter(Boolean);
  return `${parts.join('. ')}.`;
}

async function redrawWhenFontsReady() {
  if (!fontsReady) {
    try {
      await Promise.race([
        Promise.all([document.fonts.load('100px Anton'), document.fonts.load('60px Pacifico'), document.fonts.ready]),
        new Promise((r) => setTimeout(r, 3000)),
      ]);
    } catch { /* fall back to system fonts */ }
    fontsReady = true;
  }
  redraw();
}

// ---- history (undo / redo) -------------------------------------------------

function snapshot() {
  return JSON.stringify({ state, photos, selectedPanel, exportSize });
}

function pushHistory() {
  history = history.slice(0, hIndex + 1);
  history.push(snapshot());
  if (history.length > 60) history.shift();
  hIndex = history.length - 1;
  if (!shotMode) {
    unsavedChanges = true;
    writeUrlState();
  }
  updateUndoButtons();
}

async function restoreHistory(idx) {
  const snap = JSON.parse(history[idx]);
  state = snap.state;
  photos = snap.photos;
  selectedPanel = snap.selectedPanel;
  exportSize = snap.exportSize;
  canvas.width = exportSize.w;
  canvas.height = exportSize.h;
  await Promise.all(photos.map((p) => loadImage(p.src).catch(() => null)));
  syncControls();
  redraw();
  if (!shotMode) unsavedChanges = true;
  updateUndoButtons();
}

function updateUndoButtons() {
  $('undo').disabled = hIndex <= 0;
  $('redo').disabled = hIndex >= history.length - 1;
}

$('undo').addEventListener('click', async () => {
  if (hIndex > 0) { hIndex--; await restoreHistory(hIndex); }
});
$('redo').addEventListener('click', async () => {
  if (hIndex < history.length - 1) { hIndex++; await restoreHistory(hIndex); }
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault();
    $('undo').click();
  } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault();
    $('redo').click();
  }
});

// ---- photos -----------------------------------------------------------------

async function addPhoto(entry) {
  if (photos.length >= 4) {
    setStatus('Four photos at most — remove one first. The extra photo was skipped.');
    return false;
  }
  try {
    await loadImage(entry.src);
  } catch {
    setStatus(`Could not load ${entry.name}. Check the file is an image and try again, or load the sample photos instead.`);
    return false;
  }
  photos.push(entry);
  return true;
}

async function loadSamplePhoto(id) {
  const sample = SAMPLES.find((s) => s.id === id) || SAMPLES[0];
  const entry = { kind: 'sample', name: sample.name, src: `samples/${sample.id}.jpg` };
  if (photos.some((p) => p.src === entry.src)) return entry;
  if (await addPhoto(entry)) {
    state.panelPhoto = state.panelPhoto.map(() => photos.length - 1);
  }
  return entry;
}

async function loadAllSamples() {
  for (const s of SAMPLES) {
    if (photos.length >= 4) break;
    await loadSamplePhoto(s.id);
  }
  pushHistory();
  redraw();
  setStatus(`${photos.length} sample photo${photos.length === 1 ? '' : 's'} loaded.`);
}

$('loadSamples').addEventListener('click', loadAllSamples);

$('photoInput').addEventListener('change', async (e) => {
  const files = [...e.target.files].filter((f) => f.type.startsWith('image/'));
  let added = 0;
  for (const file of files) {
    const url = URL.createObjectURL(file);
    if (await addPhoto({ kind: 'upload', name: file.name, src: url })) added++;
    else URL.revokeObjectURL(url);
  }
  if (added) {
    pushHistory();
    redraw();
    setStatus(`${added} photo${added === 1 ? '' : 's'} added. Click a panel, then a thumbnail, to place one.`);
  }
  e.target.value = '';
});

// drag-and-drop onto the stage
const stage = $('stage');
['dragenter', 'dragover'].forEach((ev) => stage.addEventListener(ev, (e) => {
  e.preventDefault();
  stage.classList.add('dropping');
}));
['dragleave', 'drop'].forEach((ev) => stage.addEventListener(ev, (e) => {
  e.preventDefault();
  stage.classList.remove('dropping');
}));
stage.addEventListener('drop', async (e) => {
  const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/'));
  let added = 0;
  for (const file of files) {
    const url = URL.createObjectURL(file);
    if (await addPhoto({ kind: 'upload', name: file.name, src: url })) added++;
    else URL.revokeObjectURL(url);
  }
  if (added) { pushHistory(); redraw(); setStatus(`${added} photo${added === 1 ? '' : 's'} dropped in.`); }
});

// photo strip: click a thumbnail to put that photo in the selected panel
function renderPhotoStrip() {
  const strip = $('photoStrip');
  // A redraw rebuilds the strip: keep keyboard focus on the same thumbnail.
  const activeIdx = strip.contains(document.activeElement) && document.activeElement.dataset.photo !== undefined
    ? Number(document.activeElement.dataset.photo) : -1;
  strip.innerHTML = '';
  if (!photos.length) {
    strip.innerHTML = '<p class="hint">No photos yet — load the samples or drop your own in.</p>';
  }
  photos.forEach((p, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thumb';
    btn.dataset.photo = String(i);
    btn.title = `${p.name} — click to place in the selected panel`;
    const img = document.createElement('img');
    img.src = p.src;
    img.alt = p.name;
    img.width = 72;
    img.height = 50;
    btn.appendChild(img);
    const label = document.createElement('span');
    label.textContent = p.name;
    btn.appendChild(label);
    btn.addEventListener('click', () => {
      state.panelPhoto[selectedPanel] = i;
      pushHistory();
      redraw();
      setStatus(`${p.name} placed in panel ${selectedPanel + 1}.`);
    });
    strip.appendChild(btn);
  });
  if (activeIdx >= 0 && strip.children[activeIdx]) strip.children[activeIdx].focus();
  $('photoCount').textContent = `${photos.length}/4 photos`;
}

$('fillAll').addEventListener('click', () => {
  const idx = state.panelPhoto[selectedPanel];
  state.panelPhoto = state.panelPhoto.map(() => idx);
  pushHistory();
  redraw();
  setStatus('One photo now fills every panel.');
});

// ---- layout + grade pickers --------------------------------------------------

function buildLayoutPicker() {
  const wrap = $('layoutPicker');
  LAYOUT_IDS.forEach((id) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'layout-btn';
    btn.dataset.layout = id;
    btn.title = LAYOUT_NAMES[id];
    const mini = document.createElement('span');
    mini.className = `mini mini-${id}`;
    btn.appendChild(mini);
    const label = document.createElement('span');
    label.textContent = LAYOUT_NAMES[id];
    btn.appendChild(label);
    btn.addEventListener('click', () => {
      state.layout = id;
      state.captionY = LAYOUT_CAPTION_Y[id];
      selectedPanel = 0;
      pushHistory();
      syncControls();
      redraw();
    });
    wrap.appendChild(btn);
  });
}

function buildGradePicker() {
  const wrap = $('gradePicker');
  GRADE_IDS.forEach((id) => {
    const g = GRADES[id];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'grade-btn';
    btn.dataset.grade = id;
    btn.title = g.name;
    btn.style.background = `linear-gradient(135deg, ${g.stops[0]}, ${g.stops[1]} 55%, ${g.stops[2]})`;
    const label = document.createElement('span');
    label.textContent = g.name;
    btn.appendChild(label);
    btn.addEventListener('click', () => {
      state.grade = id;
      pushHistory();
      syncControls();
      redraw();
    });
    wrap.appendChild(btn);
  });
}

function markActivePickers() {
  document.querySelectorAll('.layout-btn').forEach((b) => {
    const on = b.dataset.layout === state.layout;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  document.querySelectorAll('.grade-btn').forEach((b) => {
    const on = b.dataset.grade === state.grade;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  document.querySelectorAll('.size-btn').forEach((b) => {
    const on = Number(b.dataset.w) === exportSize.w && Number(b.dataset.h) === exportSize.h;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

// ---- caption controls --------------------------------------------------------

function bindText(id, key) {
  $(id).addEventListener('input', () => {
    state[key] = $(id).value;
    redrawSoon();
  });
  $(id).addEventListener('change', () => pushHistory());
}
bindText('captionInput', 'caption');
bindText('subtitleInput', 'subtitle');
bindText('subcaptionInput', 'subcaption');
bindText('badgeInput', 'badge');

function bindRange(id, key, parse = Number) {
  $(id).addEventListener('input', () => {
    state[key] = parse($(id).value);
    redrawSoon();
  });
  $(id).addEventListener('change', () => pushHistory());
}
bindRange('captionScale', 'captionScale', (v) => Number(v) / 100);
bindRange('captionX', 'captionX', (v) => Number(v) / 100);
bindRange('captionY', 'captionY', (v) => Number(v) / 100);
bindRange('gradeIntensity', 'gradeIntensity', (v) => Number(v) / 100);

$('captionFill').addEventListener('change', () => {
  state.captionFill = $('captionFill').value;
  pushHistory();
  redraw();
});
$('grainToggle').addEventListener('change', () => {
  state.grain = $('grainToggle').checked;
  pushHistory();
  redraw();
});
$('heatInput').addEventListener('change', () => {
  state.heat = Number($('heatInput').value);
  pushHistory();
  redraw();
});

function syncControls() {
  $('captionInput').value = state.caption;
  $('subtitleInput').value = state.subtitle;
  $('subcaptionInput').value = state.subcaption;
  $('badgeInput').value = state.badge;
  $('captionFill').value = state.captionFill;
  $('grainToggle').checked = state.grain !== false;
  $('heatInput').value = String(state.heat);
  $('captionScale').value = String(Math.round(state.captionScale * 100));
  $('captionX').value = String(Math.round(state.captionX * 100));
  $('captionY').value = String(Math.round(state.captionY * 100));
  $('gradeIntensity').value = String(Math.round((state.gradeIntensity ?? 0.8) * 100));
  markActivePickers();
}

// ---- panel selection, drag-to-pan, zoom ---------------------------------------

function canvasPoint(e) {
  // The canvas rect is cached for the length of a drag so pointermove does not
  // pay for getBoundingClientRect on every event.
  const rect = canvasRect || canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function hitPanel(p) {
  const panels = layoutPanels(state.layout, canvas.width, canvas.height);
  for (let i = panels.length - 1; i >= 0; i--) {
    const panel = panels[i];
    const cx = panel.x + panel.w / 2;
    const cy = panel.y + panel.h / 2;
    let lx = p.x - cx;
    let ly = p.y - cy;
    if (panel.rot) {
      const c = Math.cos(-panel.rot);
      const s = Math.sin(-panel.rot);
      [lx, ly] = [lx * c - ly * s, lx * s + ly * c];
    }
    if (Math.abs(lx) <= panel.w / 2 && Math.abs(ly) <= panel.h / 2) return i;
  }
  return -1;
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  canvasRect = canvas.getBoundingClientRect();
  const p = canvasPoint(e);
  const idx = hitPanel(p);
  if (idx < 0) { canvasRect = null; return; }
  selectedPanel = idx;
  drag = { start: p, moved: false, dx: state.panelDX[idx], dy: state.panelDY[idx] };
  canvas.setPointerCapture(e.pointerId);
  renderPanelBar();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const panels = layoutPanels(state.layout, canvas.width, canvas.height);
  const panel = panels[selectedPanel];
  const ddx = (p.x - drag.start.x) / panel.w;
  const ddy = (p.y - drag.start.y) / panel.h;
  if (Math.abs(ddx) + Math.abs(ddy) > 0.002) drag.moved = true;
  state.panelDX[selectedPanel] = Math.max(-0.5, Math.min(0.5, drag.dx + ddx));
  state.panelDY[selectedPanel] = Math.max(-0.5, Math.min(0.5, drag.dy + ddy));
  redrawSoon();
});
function endDrag() {
  if (drag && drag.moved) pushHistory();
  drag = null;
  canvasRect = null;
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// Keyboard alternative to pointer-only panel work: number keys switch panels,
// arrow keys slide the selected panel's photo (Shift = bigger step).
canvas.addEventListener('keydown', (e) => {
  const k = e.key;
  if (k >= '1' && k <= '9') {
    const idx = Number(k) - 1;
    if (idx < PANEL_COUNTS[state.layout]) {
      selectedPanel = idx;
      renderPanelBar();
      setStatus(`Panel ${idx + 1} of ${PANEL_COUNTS[state.layout]} selected. Use arrow keys to slide its photo.`);
      e.preventDefault();
    }
    return;
  }
  const step = e.shiftKey ? 0.1 : 0.02;
  let dx = 0;
  let dy = 0;
  if (k === 'ArrowLeft') dx = -step;
  else if (k === 'ArrowRight') dx = step;
  else if (k === 'ArrowUp') dy = -step;
  else if (k === 'ArrowDown') dy = step;
  else return;
  e.preventDefault();
  state.panelDX[selectedPanel] = Math.max(-0.5, Math.min(0.5, (state.panelDX[selectedPanel] || 0) + dx));
  state.panelDY[selectedPanel] = Math.max(-0.5, Math.min(0.5, (state.panelDY[selectedPanel] || 0) + dy));
  keyPanMoved = true;
  redrawSoon();
});
canvas.addEventListener('keyup', (e) => {
  if (keyPanMoved && e.key.startsWith('Arrow')) {
    keyPanMoved = false;
    pushHistory();
  }
});
canvas.addEventListener('blur', () => {
  if (keyPanMoved) {
    keyPanMoved = false;
    pushHistory();
  }
});

function renderPanelBar() {
  const count = PANEL_COUNTS[state.layout];
  const photoIdx = state.panelPhoto[selectedPanel];
  const photo = photos[photoIdx];
  $('panelInfo').textContent = `Panel ${selectedPanel + 1} of ${count} — ${photo ? photo.name : 'procedural scene'}`;
  $('panelZoom').value = String(Math.round((state.panelZoom[selectedPanel] || 1) * 100));
  $('zoomValue').textContent = `${Math.round((state.panelZoom[selectedPanel] || 1) * 100)}%`;
  canvas.setAttribute('aria-label', describeCover());
}
$('panelZoom').addEventListener('input', () => {
  state.panelZoom[selectedPanel] = Number($('panelZoom').value) / 100;
  $('zoomValue').textContent = `${$('panelZoom').value}%`;
  redrawSoon();
});
$('panelZoom').addEventListener('change', () => pushHistory());

// ---- export -------------------------------------------------------------------

function buildSizeButtons() {
  const wrap = $('sizePicker');
  EXPORT_SIZES.forEach((s) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'size-btn';
    btn.dataset.w = String(s.w);
    btn.dataset.h = String(s.h);
    btn.textContent = s.label;
    btn.addEventListener('click', () => {
      exportSize = s;
      canvas.width = s.w;
      canvas.height = s.h;
      pushHistory();
      markActivePickers();
      redraw();
    });
    wrap.appendChild(btn);
  });
}

function exportCover(w, h) {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off, { ...state, images: images() });
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `cover-${w}x${h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve();
    }, 'image/png');
  });
}

$('exportOne').addEventListener('click', async () => {
  await exportCover(exportSize.w, exportSize.h);
  unsavedChanges = false;
  setStatus(`Saved cover-${exportSize.w}x${exportSize.h}.png`);
});
$('exportAll').addEventListener('click', async () => {
  setStatus('Exporting all 3 sizes…');
  for (const s of EXPORT_SIZES) {
    // eslint-disable-next-line no-await-in-loop
    await exportCover(s.w, s.h);
  }
  unsavedChanges = false;
  setStatus('Saved cover-1080x1080.png, cover-1080x1350.png and cover-1920x1080.png');
});

// ---- shareable URL state (deep-linking) --------------------------------------
// Every committed change writes the editor state into the URL with
// replaceState (no new history entries), so a link reproduces the cover.
// Uploads cannot travel in a URL: only sample photos are listed, and panel
// photo indices are remapped to the samples-only list on write. Shot mode
// (?shot=) never writes URL state.
function sampleIdOf(photo) {
  return photo.src.split('/').pop().replace(/\.jpg$/, '');
}

function writeUrlState() {
  if (new URLSearchParams(location.search).has('shot')) return;
  const p = new URLSearchParams();
  p.set('layout', state.layout);
  p.set('grade', state.grade);
  p.set('gi', String(Math.round((state.gradeIntensity ?? 0.8) * 100)));
  p.set('grain', state.grain === false ? '0' : '1');
  p.set('caption', state.caption);
  p.set('subtitle', state.subtitle);
  p.set('subcaption', state.subcaption);
  p.set('badge', state.badge);
  p.set('heat', String(state.heat));
  p.set('captionFill', state.captionFill);
  p.set('cx', String(Math.round(state.captionX * 100)));
  p.set('cy', String(Math.round(state.captionY * 100)));
  p.set('cs', String(Math.round(state.captionScale * 100)));
  const sampleIds = photos.filter((ph) => ph.kind === 'sample').map(sampleIdOf);
  if (sampleIds.length) p.set('photos', sampleIds.join(','));
  const remap = (idx) => {
    const ph = photos[idx];
    if (!ph || ph.kind !== 'sample') return 0;
    const at = sampleIds.indexOf(sampleIdOf(ph));
    return at < 0 ? 0 : at;
  };
  p.set('pp', state.panelPhoto.map(remap).join(','));
  p.set('pz', state.panelZoom.map((z) => Math.round((z || 1) * 100)).join(','));
  p.set('pdx', state.panelDX.map((v) => (v || 0).toFixed(2)).join(','));
  p.set('pdy', state.panelDY.map((v) => (v || 0).toFixed(2)).join(','));
  p.set('size', `${exportSize.w}x${exportSize.h}`);
  window.history.replaceState(null, '', `${location.pathname}?${p.toString()}`);
}

function applyUrlState(params) {
  const patch = {};
  const layout = params.get('layout');
  if (layout && LAYOUT_IDS.includes(layout)) patch.layout = layout;
  const grade = params.get('grade');
  if (grade && GRADE_IDS.includes(grade)) patch.grade = grade;
  const clamp = (v, lo, hi, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
  };
  if (params.get('gi') !== null) patch.gradeIntensity = clamp(params.get('gi'), 0, 100, 80) / 100;
  if (params.get('grain') !== null) patch.grain = params.get('grain') !== '0';
  if (params.get('caption') !== null) patch.caption = params.get('caption').slice(0, 48);
  if (params.get('subtitle') !== null) patch.subtitle = params.get('subtitle').slice(0, 48);
  if (params.get('subcaption') !== null) patch.subcaption = params.get('subcaption').slice(0, 60);
  if (params.get('badge') !== null) patch.badge = params.get('badge').slice(0, 24);
  if (params.get('heat') !== null) patch.heat = clamp(params.get('heat'), 0, 5, 5);
  if (params.get('captionFill') === 'white' || params.get('captionFill') === 'gradient') patch.captionFill = params.get('captionFill');
  if (params.get('cx') !== null) patch.captionX = clamp(params.get('cx'), 15, 85, 50) / 100;
  if (params.get('cy') !== null) patch.captionY = clamp(params.get('cy'), 50, 95, 84) / 100;
  if (params.get('cs') !== null) patch.captionScale = clamp(params.get('cs'), 60, 140, 100) / 100;
  const list = (key, n, map) => {
    const raw = params.get(key);
    if (raw === null) return null;
    const vals = raw.split(',').map(map);
    while (vals.length < n) vals.push(vals[vals.length - 1] ?? 0);
    return vals.slice(0, n);
  };
  const pp = list('pp', 9, (v) => clamp(v, 0, Math.max(0, photos.length - 1), 0));
  if (pp) patch.panelPhoto = pp;
  const pz = list('pz', 9, (v) => clamp(v, 100, 250, 100) / 100);
  if (pz) patch.panelZoom = pz;
  const pdx = list('pdx', 9, (v) => clamp(v, -0.5, 0.5, 0));
  if (pdx) patch.panelDX = pdx;
  const pdy = list('pdy', 9, (v) => clamp(v, -0.5, 0.5, 0));
  if (pdy) patch.panelDY = pdy;
  Object.assign(state, patch);
  if (patch.layout) state.captionY = LAYOUT_CAPTION_Y[patch.layout];
  if (params.get('cy') !== null) state.captionY = patch.captionY;
}

// Warn before leaving with edits that were never exported (export = save).
window.addEventListener('beforeunload', (e) => {
  if (unsavedChanges) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ---- shot API (used by shots.js) ----------------------------------------------

const api = {
  async loadSamplePhoto(id) {
    await loadSamplePhoto(id);
  },
  applyPatch(patch) {
    Object.assign(state, patch);
    if (patch.layout) state.captionY = LAYOUT_CAPTION_Y[patch.layout];
    syncControls();
  },
  setPreviewSize(w, h) {
    canvas.width = w;
    canvas.height = h;
    exportSize = { w, h, label: `${w} × ${h}` };
  },
  async redrawWhenFontsReady() {
    await redrawWhenFontsReady();
  },
};

// ---- boot ----------------------------------------------------------------------

buildLayoutPicker();
buildGradePicker();
buildSizeButtons();
syncControls();

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
shotMode = !!shot;
if (shot) {
  await runShot(shot, params, api);
  pushHistory();
} else if ([...params.keys()].length > 0) {
  // Deep link: restore the editor state the URL describes.
  const ids = (params.get('photos') || '').split(',').filter((id) => SAMPLES.some((s) => s.id === id));
  for (const id of ids.slice(0, 4)) {
    // eslint-disable-next-line no-await-in-loop
    await loadSamplePhoto(id);
  }
  if (!photos.length) await loadSamplePhoto('rooftop-sunset');
  applyUrlState(params);
  const size = (params.get('size') || '').split('x').map(Number);
  if (size.length === 2 && EXPORT_SIZES.some((s) => s.w === size[0] && s.h === size[1])) {
    exportSize = { w: size[0], h: size[1], label: `${size[0]} × ${size[1]}` };
    canvas.width = size[0];
    canvas.height = size[1];
  }
  syncControls();
  await redrawWhenFontsReady();
  pushHistory();
  unsavedChanges = false;
} else {
  await loadSamplePhoto('rooftop-sunset');
  await redrawWhenFontsReady();
  pushHistory();
  unsavedChanges = false;
}
