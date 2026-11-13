import * as THREE from 'three';
import { CLOCK, PHOTOS, PLAYER_SPRITE, SITES } from '../config';
import { drawTokyo } from './scene';

/**
 * Hour and month where Airu is, unless the visitor picked another time of day or season
 * (the corner picker, or ?hour=22&month=4); the page keeps that choice on <html data-hour data-month>.
 */
export function ownerTime() {
  const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', month: 'numeric', hourCycle: 'h23', timeZone: CLOCK.timeZone })
    .formatToParts(new Date());
  const get = (t: string) => +(parts.find((p) => p.type === t)?.value ?? 0);
  const { hour, month } = document.documentElement.dataset;
  return { hour: hour ? +hour : get('hour'), month: month ? +month : get('month') };
}

// Card faces are drawn in "card pixels" (212 x 316, the whole card, edge to edge)
// and rendered at 1024px wide for a crisp texture.
const PX = 212;
const PY = 316;
const TW = 1024;
const S = TW / PX;
const TH = Math.round(PY * S);

export const FACE_ASPECT = PX / PY;

/** Where the sprite's window sits on the engineer face, in card pixels (PX x PY). */
export const PORTRAIT = { x: 16, y: 44, w: 72, h: 92, px: PX, py: PY };

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

type Photo = { img: HTMLImageElement; focus: [number, number]; zoom: number; mono: boolean; cutout: boolean } | null;

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

/** Hard pixel square, the dev site's decoration. */
function px(g: CanvasRenderingContext2D, x: number, y: number, size: number, col: string) {
  g.fillStyle = col;
  g.fillRect(x, y, size, size);
}

/** The pixel character in a little game room: warm wall, pixel window, checker floor. */
function portrait(g: CanvasRenderingContext2D, photo: Photo, sprite: HTMLImageElement | null, x: number, y: number, w: number, h: number, k: number) {
  g.fillStyle = 'rgba(15,23,42,.25)';
  g.fillRect(x + 3, y + 3, w, h); // hard offset shadow
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  if (photo) drawPhoto(g, photo, x, y, w, h);
  else {
    // outside on a Tokyo street, at Airu's hour and season
    const floor = Math.round(y + h - Math.max(14, h * 0.2));
    const { hour, month } = ownerTime();
    drawTokyo(g, x, y, w, h, floor, hour, month);
    if (sprite) {
      // `k` = the character's height as a share of the window
      const sh = h * k, sw = (sprite.width / sprite.height) * sh;
      const cx = x + w / 2, feet = floor + (y + h - floor) * 0.55;
      g.fillStyle = 'rgba(15,23,42,.18)';
      g.beginPath();
      g.ellipse(cx, feet - sh * 0.01, sw * 0.4, sh * 0.035, 0, 0, Math.PI * 2);
      g.fill();
      // a small pixel sprite is blown up crisp; a large one is scaled down smoothly
      const upscale = sprite.height < sh * S;
      g.imageSmoothingEnabled = !upscale;
      g.imageSmoothingQuality = 'high';
      g.drawImage(sprite, cx - sw / 2, feet - sh, sw, sh);
      g.imageSmoothingEnabled = true;
    }
  }
  g.restore();
  g.strokeStyle = C.navy;
  g.lineWidth = 2;
  g.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

/**
 * Engineer side, after dev.byairu.com but quiet: faint grid paper, a slim title bar, the portrait
 * beside the name, then only the essentials (experience, base, stack), the amber role band and
 * a navy strip with the link.
 */
function drawDev(photo: Photo, sprite: HTMLImageElement | null) {
  const c = makeCanvas(TW, TH);
  const g = c.getContext('2d')!;
  g.scale(S, S);
  const D = SITES.dev;
  g.textBaseline = 'alphabetic';
  const M = 16, R = PX - M;
  const [FIRST, ...REST] = D.name.toUpperCase().split(' ');
  const LAST = REST.join(' ');

  // faint grid paper
  g.fillStyle = '#fff';
  g.fillRect(0, 0, PX, PY);
  g.strokeStyle = '#f1f5f9';
  g.lineWidth = 0.5;
  for (let x = 12; x < PX; x += 12) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, PY); g.stroke(); }
  for (let y = 12; y < PY; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(PX, y); g.stroke(); }

  // slim title bar (the strap slot is punched through its top edge)
  g.fillStyle = C.navy;
  g.fillRect(0, 0, PX, 26);
  [C.amber, C.purple, '#fff'].forEach((col, i) => px(g, M + i * 8, 15, 5, col));
  g.fillStyle = C.slate;
  g.font = `500 5.5px ${MONO}`;
  spaced(g, 'PLAYER_1.EXE', R, 20, 1.2, 'right');

  // portrait and name, centred on each other
  portrait(g, photo, sprite, PORTRAIT.x, PORTRAIT.y, PORTRAIT.w, PORTRAIT.h, 0.8);
  const nx = PORTRAIT.x + PORTRAIT.w + 14;
  g.fillStyle = C.navy;
  g.font = `800 14px ${MONO}`;
  spaced(g, FIRST, nx, 80, 0.4);
  const lw = spaced(g, LAST, nx, 97, 0.4);
  g.fillStyle = C.amber;
  g.fillRect(nx + lw + 2.5, 86, 5, 11.5);
  g.fillStyle = C.slate;
  g.font = `500 7px ${JA_GOTHIC}`;
  spaced(g, D.nameJa, nx, 112, 0.8);

  // hairline
  g.fillStyle = C.grid;
  g.fillRect(M, 156, R - M, 0.8);

  // two quiet columns
  const fact = (label: string, value: string, x: number) => {
    g.fillStyle = C.shadow;
    g.font = `600 5.5px ${MONO}`;
    spaced(g, label, x, 174, 1.4);
    g.fillStyle = C.navy;
    g.font = `700 8px ${MONO}`;
    spaced(g, value, x, 188, 0.2);
  };
  fact('EXPERIENCE', D.experience, M);
  fact('BASED IN', D.location, 112);

  // stack as plain text, two lines
  g.fillStyle = C.shadow;
  g.font = `600 5.5px ${MONO}`;
  spaced(g, 'STACK', M, 212, 1.4);
  const half = Math.ceil(D.stack.length / 2);
  g.font = `600 7.5px ${MONO}`;
  [D.stack.slice(0, half), D.stack.slice(half)].forEach((line, i) => {
    let x = M;
    line.forEach((t, j) => {
      g.fillStyle = C.navy;
      g.fillText(t, x, 226 + i * 12);
      x += g.measureText(t).width;
      if (j < line.length - 1) {
        g.fillStyle = '#cbd5e1';
        g.fillText('  /  ', x, 226 + i * 12);
        x += g.measureText('  /  ').width;
      }
    });
  });

  // bottom: the amber role band, then the navy link strip
  const LINK_H = 22, BAND_H = 38;
  const y = PY - LINK_H - BAND_H;
  g.fillStyle = C.amber;
  g.fillRect(0, y, PX, BAND_H);
  g.fillStyle = C.navy;
  g.font = `800 13px ${MONO}`;
  spaced(g, D.role.toUpperCase(), M, y + 20, 0.6);
  g.font = `600 7px ${JA_GOTHIC}`;
  spaced(g, D.roleJa, M, y + 31, 0.9);
  g.fillStyle = C.navy;
  g.fillRect(0, PY - LINK_H, PX, LINK_H);
  g.fillStyle = '#fff';
  g.font = `500 6.5px ${MONO}`;
  spaced(g, D.host, M, PY - 8.5, 0.4);
  g.fillStyle = C.slate;
  spaced(g, '↻', R, PY - 8.5, 0, 'right');
  return c;
}

/** The four-corner bracket mark of frame by airu. */
function bracket(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, arm: number, lw: number) {
  g.lineWidth = lw;
  g.beginPath();
  g.moveTo(x, y + arm); g.lineTo(x, y); g.lineTo(x + arm, y);
  g.moveTo(x + w - arm, y); g.lineTo(x + w, y); g.lineTo(x + w, y + arm);
  g.moveTo(x, y + h - arm); g.lineTo(x, y + h); g.lineTo(x + arm, y + h);
  g.moveTo(x + w - arm, y + h); g.lineTo(x + w, y + h); g.lineTo(x + w, y + h - arm);
  g.stroke();
}

/** A copy of the image whose left and/or right edge fades to transparent. */
function fadeSides(img: HTMLImageElement, left: boolean, right: boolean) {
  if (!left && !right) return img;
  const c = makeCanvas(img.width, img.height);
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0);
  const f = img.width * 0.12;
  const grad = g.createLinearGradient(0, 0, img.width, 0);
  grad.addColorStop(0, left ? 'rgba(0,0,0,0)' : '#000');
  grad.addColorStop(f / img.width, '#000');
  grad.addColorStop(1 - f / img.width, '#000');
  grad.addColorStop(1, right ? 'rgba(0,0,0,0)' : '#000');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, img.width, img.height);
  return c;
}

/**
 * Photographer side, styled after frame.byairu.com: dark and editorial, the photo edge to edge
 * with no frame around it, quiet chrome, serif name and the bracket logo.
 */
function drawFrame(photo: Photo) {
  const c = makeCanvas(TW, TH);
  const g = c.getContext('2d')!;
  g.scale(S, S);
  const F = SITES.frame;
  g.textBaseline = 'alphabetic';

  g.fillStyle = '#0b0b0b';
  g.fillRect(0, 0, PX, PY);

  // full-bleed photo
  const ph = 208;
  g.save();
  g.beginPath();
  g.rect(0, 0, PX, ph);
  g.clip();
  if (photo) {
    if (photo.cutout) {
      // soft studio backdrop: warm paper, lighter behind the head, falling off to the edges
      g.fillStyle = '#d6d1c9';
      g.fillRect(0, 0, PX, ph);
      const lift = g.createRadialGradient(PX * 0.5, ph * 0.32, 8, PX * 0.5, ph * 0.4, PX * 0.8);
      lift.addColorStop(0, 'rgba(255,253,248,.85)');
      lift.addColorStop(1, 'rgba(255,253,248,0)');
      g.fillStyle = lift;
      g.fillRect(0, 0, PX, ph);
    }
    // Neutral monochrome with gentle print-like contrast.
    if (photo.mono) g.filter = 'grayscale(1) contrast(.97) brightness(1.03)';
    if (photo.cutout) {
      // The figure keeps its size and slides sideways so the head (focus x) sits on the card's
      // centre line, under the strap. Where the source photo's own edge (a cut-off arm) lands inside
      // the card, it fades into the backdrop instead of ending in a hard line.
      const fx = photo.focus[0];
      const fw = PX * 1.02 * photo.zoom;
      const fh = (photo.img.height / photo.img.width) * fw;
      const x = PX / 2 - fx * fw;
      g.drawImage(fadeSides(photo.img, x > 0, x + fw < PX), x, 30 - fh * photo.focus[1] * 0.2, fw, fh);
    } else drawPhoto(g, photo, 0, 0, PX, ph);
    g.filter = 'none';
    // a little shade at the bottom so the caption reads on any photo
    const grad = g.createLinearGradient(0, ph - 40, 0, ph);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = grad;
    g.fillRect(0, ph - 40, PX, 40);
  } else drawSlot(g, 0, 0, PX, ph, false);
  g.restore();

  // viewfinder corners and caption on the photo
  g.strokeStyle = 'rgba(255,255,255,.9)';
  bracket(g, 12, 24, PX - 24, ph - 36, 11, 1.1);
  g.fillStyle = 'rgba(255,255,255,.92)';
  g.font = `500 5.5px ${SANS}`;
  spaced(g, F.camera.toUpperCase(), 20, ph - 20, 1.2);
  spaced(g, F.location.toUpperCase(), PX - 20, ph - 20, 1.2, 'right');

  // name, big serif, with the Japanese reading beside it
  g.fillStyle = '#f5f5f4';
  g.font = `400 44px ${SERIF}`;
  g.textAlign = 'left';
  const nw = g.measureText(F.name).width;
  g.fillText(F.name, 10, ph + 46);
  g.fillStyle = '#8a8a8a';
  g.font = `400 9px ${JA_MINCHO}`;
  spaced(g, F.nameJa, 10 + nw + 6, ph + 45, 1.2);

  // role in both languages
  g.fillStyle = '#a3a3a3';
  g.font = `500 6.5px ${SANS}`;
  const rw = spaced(g, F.role.toUpperCase(), 13, ph + 62, 2.2);
  g.font = `400 7.5px ${JA_MINCHO}`;
  spaced(g, F.roleJa, 13 + rw + 8, ph + 62, 1.6);

  // hairline, then host left and the logo right
  g.fillStyle = 'rgba(255,255,255,.16)';
  g.fillRect(13, ph + 74, PX - 26, 0.6);
  g.fillStyle = 'rgba(255,255,255,.75)';
  g.font = `500 5.8px ${SANS}`;
  spaced(g, F.host.toUpperCase(), 13, PY - 12, 1.5);

  // [ ] frame / by airu
  const lx = PX - 64, ly = PY - 28;
  g.strokeStyle = '#f5f5f4';
  bracket(g, lx, ly, 16, 16, 5, 1);
  g.fillStyle = '#f5f5f4';
  g.font = `italic 600 10px ${SERIF}`;
  g.fillText('frame', lx + 22, ly + 7.5);
  g.fillStyle = '#8a8a8a';
  g.font = `italic 400 6.5px ${SERIF}`;
  g.fillText('by', lx + 22, ly + 16);
  g.fillStyle = '#f5f5f4';
  g.font = `italic 600 10px ${SERIF}`;
  g.fillText('airu', lx + 29, ly + 16);
  return c;
}

/** Plain woven strap: one seamless tile, repeated along the band. */
function drawStrap() {
  const W = 64;
  const H = 64;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d')!;
  g.fillStyle = '#1f2024';
  g.fillRect(0, 0, W, H);
  // threads running along the strap
  for (let y = 4; y < H - 4; y += 2) {
    g.fillStyle = y % 4 === 0 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.18)';
    g.fillRect(0, y, W, 1);
  }
  // cross weave, very faint
  for (let x = 0; x < W; x += 4) {
    g.fillStyle = 'rgba(255,255,255,.02)';
    g.fillRect(x, 0, 1, H);
  }
  // stitched edges
  g.fillStyle = '#141518';
  g.fillRect(0, 0, W, 3);
  g.fillRect(0, H - 3, W, 3);
  return { canvas: c, aspect: W / H };
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

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function loadPhoto(p: (typeof PHOTOS)[keyof typeof PHOTOS]): Promise<Photo> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ img, focus: p.focus, zoom: Math.max(1, p.zoom), mono: p.mono, cutout: p.cutout });
    img.onerror = () => resolve(null);
    img.src = p.src;
  });
}

export type StrapTexture = { tex: THREE.Texture; aspect: number };
export type CardTextures = {
  dev: THREE.Texture;
  frame: THREE.Texture;
  strap: StrapTexture;
};

// fonts and pictures load once; faces can then be redrawn (e.g. the engineer side when the time changes)
let assets: Promise<[Photo, Photo, HTMLImageElement | null]> | null = null;
function loadAssets() {
  return (assets ??= Promise.all(
    [`800 16px ${MONO}`, `500 16px ${MONO}`, `400 48px ${SERIF}`, `italic 400 16px ${SERIF}`, `italic 600 16px ${SERIF}`, `600 16px ${MONO}`, `700 16px ${MONO}`, `400 8px ${SANS}`, `500 8px ${SANS}`].map((f) =>
      document.fonts.load(f).catch(() => undefined),
    ),
  ).then(() => Promise.all([loadPhoto(PHOTOS.dev), loadPhoto(PHOTOS.frame), loadImage(PLAYER_SPRITE)])));
}

/** The engineer side again, for the current (or picked) time and season. */
export async function makeDevTexture() {
  const [pd, , sprite] = await loadAssets();
  return toTexture(drawDev(pd, sprite));
}

export async function makeTextures(): Promise<CardTextures> {
  const [pd, pf, sprite] = await loadAssets();
  const st = drawStrap();
  return {
    dev: toTexture(drawDev(pd, sprite)),
    frame: toTexture(drawFrame(pf)),
    strap: { tex: toTexture(st.canvas, true), aspect: st.aspect },
  };
}
