import * as THREE from 'three';
import { PHOTOS, SITES } from '../config';

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
// Japanese falls back to the system faces: gothic next to the mono side, mincho next to the serif side.
const JA_GOTHIC = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif';
const JA_MINCHO = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

type Photo = { img: HTMLImageElement; focus: [number, number]; zoom: number } | null;

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
  return width;
}

/** Cover-fit a photo into a box, honouring the focus point and zoom from config. */
function drawPhoto(g: CanvasRenderingContext2D, p: NonNullable<Photo>, x: number, y: number, w: number, h: number) {
  const { img, focus, zoom } = p;
  const r = Math.max(w / img.width, h / img.height) * zoom;
  const sw = w / r;
  const sh = h / r;
  const sx = Math.min(Math.max(img.width * focus[0] - sw / 2, 0), img.width - sw);
  const sy = Math.min(Math.max(img.height * focus[1] - sh / 2, 0), img.height - sh);
  g.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/** Empty photo slot: a quiet tone with a focus mark, so the card still reads as finished. */
function drawSlot(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, light: boolean) {
  g.fillStyle = light ? '#eef1f5' : '#c9c6c0';
  g.fillRect(x, y, w, h);
  const cx = x + w / 2;
  const cy = y + h / 2;
  g.strokeStyle = light ? 'rgba(15,23,42,.22)' : 'rgba(255,255,255,.6)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(cx - 7, cy); g.lineTo(cx + 7, cy);
  g.moveTo(cx, cy - 7); g.lineTo(cx, cy + 7);
  g.stroke();
}

function drawDev(photo: Photo) {
  const c = makeCanvas(TW, TH);
  const g = c.getContext('2d')!;
  g.scale(S, S);
  const D = SITES.dev;

  // white card with the dev site's grid
  g.fillStyle = '#fff';
  g.fillRect(0, 0, PX, PY);
  g.strokeStyle = C.grid;
  g.lineWidth = 0.5;
  for (let x = 12; x < PX; x += 12) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, PY); g.stroke(); }
  for (let y = 12; y < PY; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(PX, y); g.stroke(); }

  // AIRU. wordmark, card type, pixel squares
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
  g.fillStyle = C.slate;
  g.font = `500 6px ${MONO}`;
  spaced(g, 'STAFF ID', dx - 6, 19, 0.6, 'right');
  g.font = `400 6px ${JA_GOTHIC}`;
  spaced(g, '社員証', dx - 6, 27, 0.8, 'right');

  // photo box: navy border + hard offset shadow, like the site's windows
  const pw = 128, ph = 136, px = (PX - pw) / 2, py = 38;
  g.fillStyle = C.shadow;
  g.fillRect(px + 5, py + 5, pw, ph);
  g.save();
  g.beginPath();
  g.rect(px, py, pw, ph);
  g.clip();
  if (photo) drawPhoto(g, photo, px, py, pw, ph);
  else drawSlot(g, px, py, pw, ph, true);
  g.restore();
  g.strokeStyle = C.navy;
  g.lineWidth = 2;
  g.strokeRect(px + 1, py + 1, pw - 2, ph - 2);

  // > PLAYER: label, name in English and Japanese
  const ny = py + ph + 20;
  g.fillStyle = C.slate;
  g.font = `500 7.5px ${MONO}`;
  const lw = spaced(g, '> PLAYER:', 12, ny, 0.5);
  g.font = `400 7px ${JA_GOTHIC}`;
  g.fillText('プレイヤー', 12 + lw + 6, ny);

  g.fillStyle = C.navy;
  g.font = `800 16px ${MONO}`;
  const [first, ...rest] = D.name.toUpperCase().split(' ');
  const last = rest.join(' ');
  spaced(g, first, 12, ny + 18, 0.6);
  const lastW = spaced(g, last, 12, ny + 36, 0.6);
  g.fillStyle = C.amber;
  g.fillRect(12 + lastW + 3, ny + 24, 7, 14);
  g.fillStyle = C.navy;
  g.font = `500 9px ${JA_GOTHIC}`;
  spaced(g, D.nameJa, 12, ny + 52, 0.6);

  // amber band with the role in both languages
  const bh = 52;
  const by = PY - bh;
  g.fillStyle = C.amber;
  g.fillRect(0, by, PX, bh);
  g.fillStyle = C.navy;
  g.fillRect(0, by, PX, 2);
  g.font = `800 13px ${MONO}`;
  spaced(g, D.role.toUpperCase(), 12, by + 19, 0.5);
  g.font = `600 8px ${JA_GOTHIC}`;
  spaced(g, D.roleJa, 12, by + 31, 0.8);
  g.font = `500 8.5px ${MONO}`;
  g.textAlign = 'left';
  g.fillText(D.host, 12, by + 44);
  g.globalAlpha = 0.5;
  g.textAlign = 'right';
  g.fillText('↻', PX - 12, by + 44);
  g.globalAlpha = 1;
  return c;
}

function drawFrame(photo: Photo) {
  const c = makeCanvas(TW, TH);
  const g = c.getContext('2d')!;
  g.scale(S, S);
  const F = SITES.frame;

  g.fillStyle = C.paper;
  g.fillRect(0, 0, PX, PY);

  // [ frame airu ] bracket logo
  const lx = 14, ly = 14, lw = 34, lh = 28, arm = 8;
  g.strokeStyle = C.ink;
  g.lineWidth = 1.2;
  g.beginPath();
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
  spaced(g, 'PRESS', PX - 14, 22, 1.6, 'right');
  g.font = `400 6.5px ${JA_MINCHO}`;
  spaced(g, '報道', PX - 14, 32, 1.6, 'right');

  // big serif name, like "Gallery.", with the Japanese reading beside it
  g.fillStyle = C.ink;
  g.font = `400 48px ${SERIF}`;
  g.textAlign = 'left';
  const nw = g.measureText(F.name).width;
  g.fillText(F.name, 11, 96);
  g.fillStyle = C.stone;
  g.font = `400 10px ${JA_MINCHO}`;
  spaced(g, F.nameJa, 11 + nw + 8, 95, 1.2);

  // role in both languages
  g.fillStyle = C.stone;
  g.font = `500 7.5px ${SANS}`;
  const rw = spaced(g, F.role.toUpperCase(), 14, 116, 2.1);
  g.font = `400 8px ${JA_MINCHO}`;
  spaced(g, F.roleJa, 14 + rw + 8, 116, 1.6);

  // full-bleed photo, black and white
  const py = 132, ph = PY - py;
  g.save();
  g.beginPath();
  g.rect(0, py, PX, ph);
  g.clip();
  if (photo) {
    g.filter = 'grayscale(1) contrast(1.05)';
    drawPhoto(g, photo, 0, py, PX, ph);
    g.filter = 'none';
  } else drawSlot(g, 0, py, PX, ph, false);
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

  g.fillStyle = '#fff';
  g.shadowColor = 'rgba(0,0,0,.4)';
  g.shadowBlur = 2;
  g.font = `500 7px ${SANS}`;
  spaced(g, F.host.toUpperCase(), 20, PY - 20, 1.3);
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
  const font = dev ? `800 24px ${MONO}` : `italic 400 34px ${SERIF}`;
  const label = dev ? 'AIRU. DEV  ·  ' : 'frame by airu  ·  ';
  probe.font = font;
  const unit = Math.ceil(probe.measureText(label).width);
  const c = makeCanvas(unit, H);
  const g = c.getContext('2d')!;
  g.fillStyle = dev ? C.amber : C.ink;
  g.fillRect(0, 0, c.width, H);
  // woven texture: faint horizontal threads
  g.fillStyle = dev ? 'rgba(15,23,42,.06)' : 'rgba(255,255,255,.05)';
  for (let y = 9; y < H - 9; y += 3) g.fillRect(0, y, c.width, 1);
  g.fillStyle = dev ? C.navy : '#3a3a3a';
  g.fillRect(0, 0, c.width, dev ? 7 : 3);
  g.fillRect(0, H - (dev ? 7 : 3), c.width, dev ? 7 : 3);
  g.fillStyle = dev ? C.navy : C.paper;
  g.font = font;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText(label, 0, H / 2 + 1);
  return { canvas: c, aspect: unit / H };
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

function loadPhoto(p: (typeof PHOTOS)['dev']): Promise<Photo> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ img, focus: p.focus, zoom: Math.max(1, p.zoom) });
    img.onerror = () => resolve(null);
    img.src = p.src;
  });
}

export type StrapTexture = { tex: THREE.Texture; aspect: number };
export type CardTextures = {
  dev: THREE.Texture;
  frame: THREE.Texture;
  strapDev: StrapTexture;
  strapFrame: StrapTexture;
};

export async function makeTextures(): Promise<CardTextures> {
  await Promise.all(
    [`800 16px ${MONO}`, `500 16px ${MONO}`, `400 48px ${SERIF}`, `italic 400 16px ${SERIF}`, `400 8px ${SANS}`, `500 8px ${SANS}`].map((f) =>
      document.fonts.load(f).catch(() => undefined),
    ),
  );
  const [pd, pf] = await Promise.all([loadPhoto(PHOTOS.dev), loadPhoto(PHOTOS.frame)]);
  const sd = drawStrap('dev');
  const sf = drawStrap('frame');
  return {
    dev: toTexture(drawDev(pd)),
    frame: toTexture(drawFrame(pf)),
    strapDev: { tex: toTexture(sd.canvas, true), aspect: sd.aspect },
    strapFrame: { tex: toTexture(sf.canvas, true), aspect: sf.aspect },
  };
}
