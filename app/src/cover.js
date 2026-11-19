// Sunset Strip — the cover render engine. Everything on the poster is drawn here with
// canvas code: the photo panels, the colour grade, and all the vector art (synthwave sun
// with slats, palm silhouettes, skyline, birds, halftone dots, grain and vignette). No
// artwork is loaded from a file except the user's own photos; the decoration is
// procedural, so the same state always paints the same cover. All coordinates are in
// canvas pixels; layouts are computed from the canvas size, so any export size works.
import { GRADES } from './grades.js';

export const LAYOUT_IDS = ['hero', 'duo', 'trio', 'quad', 'nine', 'tilted', 'fullbleed', 'story'];
export const LAYOUT_NAMES = {
  hero: 'Hero', duo: 'Duo', trio: 'Trio', quad: 'Quad',
  nine: 'Nine', tilted: 'Tilted', fullbleed: 'Full-bleed', story: 'Story',
};
export const PANEL_COUNTS = { hero: 1, duo: 2, trio: 3, quad: 4, nine: 9, tilted: 3, fullbleed: 1, story: 1 };
export const LAYOUT_CAPTION_Y = { hero: 0.84, duo: 0.86, trio: 0.88, quad: 0.88, nine: 0.9, tilted: 0.84, fullbleed: 0.86, story: 0.86 };

/** Small deterministic PRNG (mulberry32) so a cover repaints identically every time. */
export function rngFromSeed(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Panel rectangles for a layout, in canvas pixels. Each panel: {x, y, w, h, rot, frame}. */
export function layoutPanels(layout, w, h) {
  const g = Math.max(6, Math.round(Math.min(w, h) * 0.012)); // black gutter
  const half = (w - g) / 2;
  const third = (w - 2 * g) / 3;
  switch (layout) {
    case 'duo': return [
      { x: 0, y: 0, w: half, h, rot: 0, frame: true },
      { x: half + g, y: 0, w: half, h, rot: 0, frame: true },
    ];
    case 'trio': {
      const top = h * 0.6;
      return [
        { x: 0, y: 0, w, h: top, rot: 0, frame: true },
        { x: 0, y: top + g, w: half, h: h - top - g, rot: 0, frame: true },
        { x: half + g, y: top + g, w: half, h: h - top - g, rot: 0, frame: true },
      ];
    }
    case 'quad': {
      const hh = (h - g) / 2;
      return [
        { x: 0, y: 0, w: half, h: hh, rot: 0, frame: true },
        { x: half + g, y: 0, w: half, h: hh, rot: 0, frame: true },
        { x: 0, y: hh + g, w: half, h: hh, rot: 0, frame: true },
        { x: half + g, y: hh + g, w: half, h: hh, rot: 0, frame: true },
      ];
    }
    case 'nine': {
      const hh = (h - 2 * g) / 3;
      const out = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
        out.push({ x: c * (third + g), y: r * (hh + g), w: third, h: hh, rot: 0, frame: true });
      return out;
    }
    case 'tilted': {
      const pw = w * 0.48, ph = h * 0.62;
      return [
        { x: w * 0.27 - pw / 2, y: h * 0.40 - ph / 2, w: pw, h: ph, rot: -0.12, frame: 'snap' },
        { x: w * 0.72 - pw / 2, y: h * 0.44 - ph / 2, w: pw, h: ph, rot: 0.07, frame: 'snap' },
        { x: w * 0.5 - pw / 2, y: h * 0.62 - ph / 2, w: pw, h: ph, rot: -0.03, frame: 'snap' },
      ];
    }
    case 'fullbleed': return [{ x: 0, y: 0, w, h, rot: 0, frame: false }];
    case 'story': return [{ x: 0, y: 0, w, h, rot: 0, frame: true }];
    case 'hero':
    default: return [{ x: 0, y: 0, w, h, rot: 0, frame: true }];
  }
}

// ---- procedural vector art -------------------------------------------------

/** A synthwave sun: a gradient disc with horizontal slats cut out of its lower half. */
function drawSun(ctx, cx, cy, r, top, bottom) {
  const off = document.createElement('canvas');
  const pad = 4;
  off.width = off.height = Math.ceil(r * 2 + pad * 2);
  const o = off.getContext('2d');
  const grad = o.createLinearGradient(0, 0, 0, off.height);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  o.fillStyle = grad;
  o.beginPath();
  o.arc(off.width / 2, off.height / 2, r, 0, Math.PI * 2);
  o.fill();
  o.globalCompositeOperation = 'destination-out';
  let y = off.height / 2 + r * 0.08;
  let th = Math.max(2, r * 0.02);
  while (y < off.height) {
    o.fillRect(0, y, off.width, th);
    y += th + r * 0.14;
    th += Math.max(1, r * 0.02);
  }
  ctx.drawImage(off, cx - off.width / 2, cy - off.height / 2);
}

/** A palm silhouette: curved trunk plus seven drooping fronds. */
function drawPalm(ctx, x, y, s, color, lean, rng) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  const topX = x + lean * s * 0.9;
  const topY = y - s;
  ctx.lineWidth = Math.max(2, s * 0.055);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * s * 0.45, y - s * 0.55, topX, topY);
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.08 + (i / 6) * 0.84); // sweep across the top
    const len = s * (0.5 + rng() * 0.24);
    const ex = topX + Math.cos(a) * len * (lean >= 0 ? 1 : -1) * -1;
    const ey = topY - Math.sin(a) * len * 0.55 + len * 0.3;
    ctx.lineWidth = Math.max(2, s * 0.04);
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + (ex - topX) * 0.55, topY - len * 0.3, ex, ey);
    ctx.stroke();
  }
  // coconuts
  ctx.beginPath();
  ctx.arc(topX - s * 0.03, topY + s * 0.03, Math.max(2, s * 0.03), 0, Math.PI * 2);
  ctx.arc(topX + s * 0.04, topY + s * 0.05, Math.max(2, s * 0.025), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A jagged skyline silhouette along the bottom of a rectangle. */
function drawSkyline(ctx, x, y, w, h, color, rng) {
  ctx.save();
  ctx.fillStyle = color;
  let bx = x;
  while (bx < x + w) {
    const bw = w * (0.05 + rng() * 0.09);
    const bh = h * (0.25 + rng() * 0.75);
    ctx.fillRect(bx, y + h - bh, bw, bh);
    if (rng() > 0.6) ctx.fillRect(bx + bw * 0.3, y + h - bh - h * 0.12, bw * 0.18, h * 0.12);
    bx += bw + w * 0.012;
  }
  ctx.restore();
}

/** A few small birds as double-curve strokes. */
function drawBirds(ctx, w, h, color, rng) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, h * 0.0022);
  const n = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const bx = w * (0.08 + rng() * 0.5);
    const by = h * (0.05 + rng() * 0.16);
    const s = h * (0.008 + rng() * 0.008);
    ctx.beginPath();
    ctx.moveTo(bx - s, by);
    ctx.quadraticCurveTo(bx - s * 0.4, by - s * 0.7, bx, by);
    ctx.quadraticCurveTo(bx + s * 0.4, by - s * 0.7, bx + s, by);
    ctx.stroke();
  }
  ctx.restore();
}

/** Halftone dots: rows of shrinking dots, classic comic-title-block texture. */
function drawHalftone(ctx, x, y, w, h, color, alpha) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  const step = Math.max(10, w * 0.02);
  let row = 0;
  for (let yy = y; yy < y + h; yy += step, row++) {
    for (let xx = x + (row % 2 ? step / 2 : 0); xx < x + w; xx += step) {
      const t = 1 - (yy - y) / Math.max(1, h);
      const r = Math.max(0.6, step * 0.22 * (0.4 + t));
      ctx.beginPath();
      ctx.arc(xx, yy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

let grainTile = null;
function getGrainTile(seed) {
  if (grainTile && grainTile.seed === seed) return grainTile.tile;
  const size = 128;
  const tile = document.createElement('canvas');
  tile.width = tile.height = size;
  const t = tile.getContext('2d');
  const img = t.createImageData(size, size);
  const rng = rngFromSeed(seed * 7919 + 13);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rng() * 255);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  t.putImageData(img, 0, 0);
  grainTile = { seed, tile };
  return tile;
}

/** A full procedural scene (gradient sky, sun, skyline, palms, birds) for empty panels. */
function drawProceduralScene(ctx, rect, grade, seed) {
  const { x, y, w, h } = rect;
  const rng = rngFromSeed(seed);
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, grade.sky[0]);
  sky.addColorStop(1, grade.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  drawSun(ctx, x + w * 0.68, y + h * 0.42, Math.min(w, h) * 0.22, grade.sun[0], grade.sun[1]);
  drawBirds(ctx, w, h, 'rgba(10,4,16,0.85)', rngFromSeed(seed + 7));
  drawSkyline(ctx, x, y + h * 0.62, w, h * 0.38, 'rgba(10,4,16,0.9)', rng);
  drawPalm(ctx, x + w * 0.12, y + h, h * 0.42, 'rgba(10,4,16,0.95)', 0.25, rng);
  drawPalm(ctx, x + w * 0.9, y + h, h * 0.34, 'rgba(10,4,16,0.95)', -0.3, rng);
}

// ---- photo panels ----------------------------------------------------------

function drawPanelPhoto(ctx, img, panel, zoom, dx, dy) {
  const { x, y, w, h } = panel;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const cx = x + w / 2 + dx * w;
  const cy = y + h / 2 + dy * h;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
}

function withPanelClip(ctx, panel, fn) {
  ctx.save();
  ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
  if (panel.rot) ctx.rotate(panel.rot);
  ctx.translate(-panel.w / 2, -panel.h / 2);
  ctx.beginPath();
  ctx.rect(0, 0, panel.w, panel.h);
  ctx.clip();
  fn();
  ctx.restore();
}

// ---- caption ----------------------------------------------------------------

function fitLines(ctx, text, maxWidth, startSize) {
  const words = text.split(/\s+/).filter(Boolean);
  let size = startSize;
  let lines = [text];
  while (size > 12) {
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) return { size, lines: [text] };
    // try two lines
    let best = null;
    for (let cut = 1; cut < words.length; cut++) {
      const a = words.slice(0, cut).join(' ');
      const b = words.slice(cut).join(' ');
      if (ctx.measureText(a).width <= maxWidth && ctx.measureText(b).width <= maxWidth) {
        best = [a, b];
        break;
      }
    }
    if (best) return { size, lines: best };
    size -= 4;
  }
  return { size, lines: [text] };
}

function drawCaption(ctx, w, h, state, grade) {
  const cx = w * state.captionX;
  const cy = h * state.captionY;
  const unit = Math.min(w, h);
  const text = (state.caption || '').trim().toUpperCase();
  if (!text) return;

  const startSize = unit * 0.15 * state.captionScale;
  const { size, lines } = fitLines(ctx, text, w * 0.92, startSize);
  const lineH = size * 1.02;
  const totalH = lineH * lines.length;
  const sub = (state.subtitle || '').trim();
  const subSize = Math.max(18, unit * 0.052 * state.captionScale);
  const subcap = (state.subcaption || '').trim();
  const scSize = Math.max(13, unit * 0.026);
  // Keep the whole title block (subtitle + title + sub-caption) inside the canvas:
  // a two-line title on a tall cover would otherwise push the sub-caption off the edge.
  const subSpace = subcap ? scSize * 2.6 : 0;
  let titleTop = cy - totalH / 2;
  const overflow = titleTop + totalH + subSpace - h * 0.985;
  if (overflow > 0) titleTop -= overflow;

  // hard offset shadow, then outlined fill
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  lines.forEach((line, i) => {
    const ly = titleTop + lineH * i + lineH / 2;
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
    // shadow slab
    ctx.fillStyle = 'rgba(10,4,16,0.9)';
    ctx.fillText(line, cx + size * 0.045, ly + size * 0.05);
    // fill
    if (state.captionFill === 'gradient') {
      const grad = ctx.createLinearGradient(0, ly - size / 2, 0, ly + size / 2);
      grad.addColorStop(0, grade.capGrad[0]);
      grad.addColorStop(1, grade.capGrad[1]);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = '#FFF6EC';
    }
    ctx.lineWidth = Math.max(3, size * 0.13);
    ctx.strokeStyle = '#0D0512';
    ctx.strokeText(line, cx, ly);
    ctx.fillText(line, cx, ly);
  });
  ctx.restore();

  // script subtitle above the title
  if (sub) {
    ctx.save();
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = grade.accent;
    ctx.shadowColor = grade.accent;
    ctx.shadowBlur = subSize * 0.45;
    ctx.fillText(sub, cx, titleTop - subSize * 0.85);
    ctx.restore();
  }

  // sub-caption below the title
  if (subcap) {
    ctx.save();
    ctx.font = `600 ${scSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,246,236,0.92)';
    try { ctx.letterSpacing = `${scSize * 0.32}px`; } catch { /* older canvas */ }
    ctx.fillText(subcap.toUpperCase(), cx, titleTop + totalH + scSize * 1.1);
    ctx.restore();
  }
}

function drawBadge(ctx, w, h, state, grade) {
  const badge = (state.badge || '').trim();
  if (!badge) return;
  const unit = Math.min(w, h);
  const size = Math.max(13, unit * 0.024);
  ctx.save();
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  const tw = ctx.measureText(badge).width + size * 2.4;
  const th = size * 2.1;
  ctx.translate(w * 0.06 + tw / 2, h * 0.055 + th / 2);
  ctx.rotate(-0.045);
  ctx.fillStyle = '#FFC93C';
  ctx.fillRect(-tw / 2, -th / 2, tw, th);
  ctx.strokeStyle = '#0D0512';
  ctx.lineWidth = Math.max(2, size * 0.12);
  ctx.strokeRect(-tw / 2, -th / 2, tw, th);
  ctx.fillStyle = '#160A1E';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, 0, size * 0.06);
  ctx.restore();
}

function drawHeat(ctx, w, h, state) {
  if (!state.heat || state.heat < 1) return;
  const unit = Math.min(w, h);
  const size = Math.max(16, unit * 0.034);
  ctx.save();
  ctx.font = `${size}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const y = h * 0.115; // under the badge ribbon, clear of the sun at top-right
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < state.heat ? '★' : '☆';
  ctx.fillStyle = '#FFC93C';
  ctx.shadowColor = 'rgba(255,201,60,0.8)';
  ctx.shadowBlur = size * 0.4;
  ctx.fillText(stars, w * 0.06, y);
  ctx.restore();
}

// ---- main entry -------------------------------------------------------------

/**
 * Paints the whole cover onto `canvas` from a state object:
 * { images, layout, grade, gradeIntensity, grain, caption, subtitle, subcaption,
 *   badge, heat, captionFill, captionX, captionY, captionScale,
 *   panelPhoto[], panelZoom[], panelDX[], panelDY[], seed }
 * `images` is an array of HTMLImageElement (or null); panelPhoto[i] picks which one
 * fills panel i. Panels with no photo get a procedural vector scene instead.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const grade = GRADES[state.grade] || GRADES.vice;
  const seed = state.seed || 20261119;
  const rng = rngFromSeed(seed + 101);

  // backdrop
  ctx.fillStyle = '#160A1E';
  ctx.fillRect(0, 0, w, h);

  // panels
  const panels = layoutPanels(state.layout, w, h);
  panels.forEach((panel, i) => {
    const photoIdx = (state.panelPhoto && state.panelPhoto[i]) ?? 0;
    const img = state.images ? state.images[photoIdx] : null;
    const zoom = (state.panelZoom && state.panelZoom[i]) || 1;
    const dx = (state.panelDX && state.panelDX[i]) || 0;
    const dy = (state.panelDY && state.panelDY[i]) || 0;

    // snapshot-style white frame for tilted panels
    if (panel.frame === 'snap') {
      ctx.save();
      ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
      ctx.rotate(panel.rot);
      const bw = Math.max(8, w * 0.012);
      const bb = Math.max(26, h * 0.045);
      ctx.fillStyle = '#FFF6EC';
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = Math.max(12, w * 0.02);
      ctx.shadowOffsetY = Math.max(6, h * 0.01);
      ctx.fillRect(-panel.w / 2 - bw, -panel.h / 2 - bw, panel.w + bw * 2, panel.h + bw + bb);
      ctx.restore();
    }

    withPanelClip(ctx, panel, () => {
      if (img) {
        drawPanelPhoto(ctx, img, { x: 0, y: 0, w: panel.w, h: panel.h }, zoom, dx, dy);
      } else {
        drawProceduralScene(ctx, { x: 0, y: 0, w: panel.w, h: panel.h }, grade, seed + i * 31);
      }
    });

    if (panel.frame === true) {
      ctx.save();
      ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
      if (panel.rot) ctx.rotate(panel.rot);
      ctx.strokeStyle = 'rgba(255,246,236,0.9)';
      ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.002);
      ctx.strokeRect(-panel.w / 2, -panel.h / 2, panel.w, panel.h);
      ctx.restore();
    }
  });

  // grade wash over everything
  const intensity = state.gradeIntensity ?? 0.8;
  if (intensity > 0) {
    const wash = ctx.createLinearGradient(0, 0, 0, h);
    grade.stops.forEach((c, i) => wash.addColorStop(i / (grade.stops.length - 1), c));
    ctx.save();
    ctx.globalAlpha = intensity * 0.42;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = intensity * 0.3;
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // legibility scrim under the caption band
  const scrim = ctx.createLinearGradient(0, h * 0.55, 0, h);
  scrim.addColorStop(0, 'rgba(10,4,16,0)');
  scrim.addColorStop(1, 'rgba(10,4,16,0.62)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, w, h);

  // vector decoration over the whole poster
  const unit = Math.min(w, h);
  drawSun(ctx, w * 0.87, h * 0.15, unit * 0.11, grade.sun[0], grade.sun[1]);
  drawBirds(ctx, w, h, 'rgba(13,5,18,0.9)', rngFromSeed(seed + 7));
  drawPalm(ctx, w * 0.03, h * 0.995, h * 0.24, 'rgba(13,5,18,0.92)', 0.3, rng);
  drawPalm(ctx, w * 0.97, h * 0.995, h * 0.19, 'rgba(13,5,18,0.92)', -0.35, rng);
  drawSkyline(ctx, 0, h * 0.955, w, h * 0.045, 'rgba(13,5,18,0.85)', rngFromSeed(seed + 23));
  drawHalftone(ctx, w * 0.03, h * 0.62, w * 0.12, h * 0.14, grade.accent, 0.35);
  drawHalftone(ctx, w * 0.85, h * 0.62, w * 0.12, h * 0.14, grade.accent, 0.35);

  // lettering
  drawBadge(ctx, w, h, state, grade);
  drawHeat(ctx, w, h, state);
  drawCaption(ctx, w, h, state, grade);

  // grain + vignette
  if (state.grain !== false) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(getGrainTile(seed), 'repeat');
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(10,4,16,0)');
  vig.addColorStop(1, 'rgba(10,4,16,0.38)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // thin outer frame so the poster reads as one object
  ctx.strokeStyle = 'rgba(255,246,236,0.55)';
  ctx.lineWidth = Math.max(2, unit * 0.003);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
}

/** A fresh default state (serialisable; images live outside it). */
export function defaultState() {
  return {
    layout: 'hero',
    grade: 'vice',
    gradeIntensity: 0.8,
    grain: true,
    caption: 'SUNSET HEIST',
    subtitle: 'Vice City nights',
    subcaption: 'A story in three acts',
    badge: '★ EST. 2026 ★',
    heat: 5,
    captionFill: 'white',
    captionX: 0.5,
    captionY: 0.84,
    captionScale: 1,
    panelPhoto: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    panelZoom: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    panelDX: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    panelDY: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    seed: 20261119,
  };
}
