import * as THREE from 'three';
import { AVATAR, SITES, type AvatarMode } from '../config';

// Card faces are drawn in "card pixels" (212 x 316, the inner card of the holder)
// and rendered at 1024px wide for a crisp texture.
const PX = 212;
const PY = 316;
const TW = 1024;
const S = TW / PX;
const TH = Math.round(PY * S);

export const FACE_ASPECT = PX / PY;

const C = {
  navy: '#0f172a',
  amber: '#e9aa18',
  purple: '#6513be',
  slate: '#64748b',
  shadow: '#94a3b8',
  grid: '#e2e8f0',
  paper: '#f7f7f5',
  ink: '#171717',
  stone: '#737373',
};

const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const SERIF = '"Cormorant Garamond", Georgia, serif';
const SANS = '"Inter Tight", "Helvetica Neue", Arial, sans-serif';

// 12x12 pixel characters. Same person, two outfits.
const PIX = {
  dev: ['....hhhh....', '...hhhhhh...', '..hhhhhhhh..', '..hssssssh..', '..sggsggss..', '..sgesgess..', '..ssssssss..', '...ssmmss...', '....ssss....', '..tttttttt..', '.tttttttttt.', '.tttttttttt.'],
  frame: ['...cccccc...', '..cccccccc..', '..hhhhhhhh..', '..hssssssh..', '..ssssssss..', '..sesssess..', '..ssssssss..', '...ssmmss...', '....ssss....', '..tttttttt..', '.tbbblllbbt.', '.tbbbbbbbbt.'],
};
const PAL: Record<'dev' | 'frame', Record<string, string>> = {
  dev: { h: C.navy, s: '#c98b5e', g: C.purple, e: C.navy, m: '#8a4b33', t: C.amber },
  frame: { c: C.ink, h: C.ink, s: '#c98b5e', e: C.ink, m: '#8a4b33', t: '#e9e7e2', b: '#2b2b2b', l: '#a3a3a3' },
};

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Text with letter-spacing, drawn char by char (canvas letterSpacing is not everywhere yet). */
function spaced(g: CanvasRenderingContext2D, text: string, x: number, y: number, sp: number, align: 'left' | 'right' = 'left') {
  g.textAlign = 'left';
  const chars = [...text];
  const width = chars.reduce((w, ch) => w + g.measureText(ch).width + sp, 0) - sp;
  let cx = align === 'right' ? x - width : x;
  for (const ch of chars) {
    g.fillText(ch, cx, y);
    cx += g.measureText(ch).width + sp;
  }
}

function drawPixels(g: CanvasRenderingContext2D, kind: 'dev' | 'frame', x: number, y: number, size: number) {
  const cell = size / 12;
  PIX[kind].forEach((row, ry) =>
    [...row].forEach((ch, rx) => {
      const col = PAL[kind][ch];
      if (!col) return;
      g.fillStyle = col;
      // tiny overlap avoids hairline seams between cells
      g.fillRect(x + rx * cell, y + ry * cell, cell + 0.05, cell + 0.05);
    }),
  );
}

function drawCover(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const r = Math.max(w / img.width, h / img.height);
  const sw = w / r;
  const sh = h / r;
  g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function drawDev(mode: AvatarMode, img: HTMLImageElement | null) {
  const c = makeCanvas(TW, TH);
  const g = c.getContext('2d')!;
  g.scale(S, S);

  // white card with the dev site's grid
  g.fillStyle = '#fff';
  g.fillRect(0, 0, PX, PY);
  g.strokeStyle = C.grid;
  g.lineWidth = 0.5;
  for (let x = 12; x < PX; x += 12) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, PY); g.stroke(); }
  for (let y = 12; y < PY; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(PX, y); g.stroke(); }

  // AIRU. wordmark + pixel squares
  g.textBaseline = 'alphabetic';
  g.font = `800 13px ${MONO}`;
  g.fillStyle = C.navy;
  g.textAlign = 'left';
  g.fillText('AIRU', 12, 25);
  g.fillStyle = C.amber;
  g.fillText('.', 12 + g.measureText('AIRU').width, 25);
  const dx = PX - 26;
  [[0, 0, C.amber], [8, 0, C.amber], [0, 8, C.amber], [8, 8, C.purple]].forEach(([ox, oy, col]) => {
    g.fillStyle = col as string;
    g.fillRect(dx + (ox as number), 13 + (oy as number), 6, 6);
  });

  // photo box: navy border + hard offset shadow, like the site's windows
  const pw = 132, ph = 142, px = (PX - pw) / 2, py = 38;
  g.fillStyle = C.shadow;
  g.fillRect(px + 5, py + 5, pw, ph);
  g.fillStyle = '#f1f5f9';
  g.fillRect(px, py, pw, ph);
  g.save();
  g.beginPath();
  g.rect(px, py, pw, ph);
  g.clip();
  if (mode === 'image' && img) drawCover(g, img, px, py, pw, ph);
  else if (mode === 'mono') {
    g.fillStyle = C.navy;
    g.font = `800 46px ${MONO}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('>_', px + pw / 2, py + ph / 2 + 2);
  } else drawPixels(g, 'dev', px + (pw - 112) / 2, py + ph - 112, 112);
  g.restore();
  g.strokeStyle = C.navy;
  g.lineWidth = 2;
  g.strokeRect(px + 1, py + 1, pw - 2, ph - 2);

  // > PLAYER: + name with cursor
  g.textBaseline = 'alphabetic';
  g.fillStyle = C.slate;
  g.font = `500 8px ${MONO}`;
  spaced(g, '> PLAYER:', 12, py + ph + 22, 0.5);
  g.fillStyle = C.navy;
  g.font = `800 16px ${MONO}`;
  const [first, ...rest] = SITES.dev.name.toUpperCase().split(' ');
  const last = rest.join(' ');
  spaced(g, first, 12, py + ph + 40, 0.6);
  spaced(g, last, 12, py + ph + 58, 0.6);
  const lw = [...last].reduce((w, ch) => w + g.measureText(ch).width + 0.6, 0);
  g.fillStyle = C.amber;
  g.fillRect(12 + lw + 2, py + ph + 46, 7, 14);

  // amber band, like the ID band in the reference
  const by = PY - 48;
  g.fillStyle = C.amber;
  g.fillRect(0, by, PX, 48);
  g.fillStyle = C.navy;
  g.fillRect(0, by, PX, 2);
  g.font = `800 13px ${MONO}`;
  spaced(g, SITES.dev.role.toUpperCase(), 12, by + 21, 0.5);
  g.font = `500 9.5px ${MONO}`;
  g.textAlign = 'left';
  g.fillText(SITES.dev.host, 12, by + 37);
  g.globalAlpha = 0.5;
  g.textAlign = 'right';
  g.fillText('↻', PX - 12, by + 37);
  g.globalAlpha = 1;
  return c;
}

function drawFrame(mode: AvatarMode, img: HTMLImageElement | null) {
  const c = makeCanvas(TW, TH);
  const g = c.getContext('2d')!;
  g.scale(S, S);

  g.fillStyle = C.paper;
  g.fillRect(0, 0, PX, PY);

  // [ frame airu ] bracket logo
  const lx = 14, ly = 14, lw = 34, lh = 28, arm = 8;
  g.strokeStyle = C.ink;
  g.lineWidth = 1.2;
  g.beginPath();
  // top-left, bottom-left, top-right, bottom-right corners
  g.moveTo(lx, ly + arm); g.lineTo(lx, ly); g.lineTo(lx + arm, ly);
  g.moveTo(lx, ly + lh - arm); g.lineTo(lx, ly + lh); g.lineTo(lx + arm, ly + lh);
  g.moveTo(lx + lw - arm, ly); g.lineTo(lx + lw, ly); g.lineTo(lx + lw, ly + arm);
  g.moveTo(lx + lw - arm, ly + lh); g.lineTo(lx + lw, ly + lh); g.lineTo(lx + lw, ly + lh - arm);
  g.stroke();
  g.fillStyle = C.ink;
  g.font = `italic 400 9.5px ${SERIF}`;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.fillText('frame', lx + 7, ly + 12.5);
  g.fillText('airu', lx + 9, ly + 21.5);

  // tracked micro labels, top right
  g.fillStyle = C.stone;
  g.font = `400 6.5px ${SANS}`;
  spaced(g, 'TOKYO', PX - 14, 22, 1.6, 'right');
  spaced(g, 'FUJIFILM X-S20', PX - 14, 32, 1.6, 'right');

  // big serif name, like "Gallery."
  g.fillStyle = C.ink;
  g.font = `400 48px ${SERIF}`;
  g.textAlign = 'left';
  g.fillText(SITES.frame.name, 11, 98);
  g.fillStyle = C.stone;
  g.font = `500 7.5px ${SANS}`;
  spaced(g, SITES.frame.role.toUpperCase(), 14, 116, 2.1);

  // full-bleed photo, black and white
  const py = 140, ph = PY - py;
  const grad = g.createLinearGradient(0, py, PX * 0.3, PY);
  grad.addColorStop(0, '#d6d3cc');
  grad.addColorStop(1, '#8f8a82');
  g.fillStyle = grad;
  g.fillRect(0, py, PX, ph);
  g.save();
  g.beginPath();
  g.rect(0, py, PX, ph);
  g.clip();
  if (mode === 'image' && img) {
    g.filter = 'grayscale(1) contrast(1.05)';
    drawCover(g, img, 0, py, PX, ph);
    g.filter = 'none';
  } else if (mode === 'mono') {
    g.fillStyle = 'rgba(255,255,255,.9)';
    g.font = `italic 400 130px ${SERIF}`;
    g.textAlign = 'center';
    g.fillText('A', PX / 2, PY - 18);
  } else drawPixels(g, 'frame', (PX - 124) / 2, PY - 124, 124);
  g.restore();

  // viewfinder corners
  g.strokeStyle = 'rgba(255,255,255,.88)';
  g.lineWidth = 1.2;
  const i = 12, a = 12, x0 = i, y0 = py + i, x1 = PX - i, y1 = PY - i;
  g.beginPath();
  g.moveTo(x0, y0 + a); g.lineTo(x0, y0); g.lineTo(x0 + a, y0);
  g.moveTo(x1 - a, y0); g.lineTo(x1, y0); g.lineTo(x1, y0 + a);
  g.moveTo(x0, y1 - a); g.lineTo(x0, y1); g.lineTo(x0 + a, y1);
  g.moveTo(x1 - a, y1); g.lineTo(x1, y1); g.lineTo(x1, y1 - a);
  g.stroke();

  // host on the paper, right of the role line; turn mark in the frame corner
  g.fillStyle = C.ink;
  g.font = `500 7px ${SANS}`;
  spaced(g, SITES.frame.host.toUpperCase(), PX - 14, 116, 1.3, 'right');
  g.fillStyle = '#fff';
  g.shadowColor = 'rgba(0,0,0,.35)';
  g.shadowBlur = 2;
  g.font = `500 8px ${SANS}`;
  g.textAlign = 'right';
  g.fillText('↻', PX - 20, PY - 20);
  g.shadowBlur = 0;
  return c;
}

/** Woven strap texture: one seamless tile, repeated along the band. */
function drawStrap(kind: 'dev' | 'frame') {
  const dev = kind === 'dev';
  const H = 64;
  const probe = makeCanvas(8, 8).getContext('2d')!;
  const font = dev ? `800 26px ${MONO}` : `italic 400 36px ${SERIF}`;
  const label = dev ? 'AIRU. DEV  ·  ' : 'frame by airu  ·  ';
  probe.font = font;
  const unit = Math.ceil(probe.measureText(label).width);
  const c = makeCanvas(unit * 2, H);
  const g = c.getContext('2d')!;
  g.fillStyle = dev ? C.amber : C.ink;
  g.fillRect(0, 0, c.width, H);
  g.fillStyle = dev ? C.navy : '#3a3a3a';
  g.fillRect(0, 0, c.width, dev ? 7 : 3);
  g.fillRect(0, H - (dev ? 7 : 3), c.width, dev ? 7 : 3);
  g.fillStyle = dev ? C.navy : C.paper;
  g.font = font;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText(label, 0, H / 2 + 1);
  g.fillText(label, unit, H / 2 + 1);
  return c;
}

function toTexture(c: HTMLCanvasElement, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.needsUpdate = true;
  return t;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export type CardTextures = {
  dev: THREE.Texture;
  frame: THREE.Texture;
  strapDev: THREE.Texture;
  strapFrame: THREE.Texture;
};

export async function makeTextures(requested: AvatarMode): Promise<CardTextures> {
  await Promise.all(
    [`800 16px ${MONO}`, `500 16px ${MONO}`, `400 48px ${SERIF}`, `italic 400 16px ${SERIF}`, `400 8px ${SANS}`, `500 8px ${SANS}`].map((f) =>
      document.fonts.load(f).catch(() => undefined),
    ),
  );
  let mode = requested;
  let imgs: [HTMLImageElement, HTMLImageElement] | null = null;
  if (mode === 'image') {
    try {
      imgs = await Promise.all([loadImage(AVATAR.images.dev), loadImage(AVATAR.images.frame)]);
    } catch {
      mode = 'pixel';
    }
  }
  return {
    dev: toTexture(drawDev(mode, imgs?.[0] ?? null)),
    frame: toTexture(drawFrame(mode, imgs?.[1] ?? null)),
    strapDev: toTexture(drawStrap('dev'), true),
    strapFrame: toTexture(drawStrap('frame'), true),
  };
}
