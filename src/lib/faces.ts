import * as THREE from 'three';
import { PHOTOS, PLAYER_SPRITE, SITES } from '../config';

// Card faces are drawn in "card pixels" (212 x 316, the whole card, edge to edge)
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

type Photo = { img: HTMLImageElement; focus: [number, number]; zoom: number; mono: boolean } | null;

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

/** Segmented retro bar: a navy outline, filled cells up to `v` (0..1). */
function bar(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, v: number, col: string) {
  g.fillStyle = '#fff';
  g.fillRect(x, y, w, h);
  const cell = 5;
  const cells = Math.floor((w - 2) / cell);
  for (let i = 0; i < Math.round(cells * v); i++) {
    g.fillStyle = col;
    g.fillRect(x + 1.5 + i * cell, y + 1.5, cell - 1, h - 3);
  }
  g.strokeStyle = C.navy;
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/**
 * Engineer side, styled after dev.byairu.com: a retro game window (PORTFOLIO.EXE), grid paper,
 * a player portrait with character stats, and the amber role band.
 */
function drawDev(photo: Photo, sprite: HTMLImageElement | null) {
  const c = makeCanvas(TW, TH);
  const g = c.getContext('2d')!;
  g.scale(S, S);
  const D = SITES.dev;
  g.textBaseline = 'alphabetic';

  // grid paper
  g.fillStyle = '#fff';
  g.fillRect(0, 0, PX, PY);
  g.strokeStyle = C.grid;
  g.lineWidth = 0.5;
  for (let x = 12; x < PX; x += 12) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, PY); g.stroke(); }
  for (let y = 12; y < PY; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(PX, y); g.stroke(); }

  // window title bar (the strap slot is punched through its top edge)
  const tb = 32;
  g.fillStyle = C.navy;
  g.fillRect(0, 0, PX, tb);
  px(g, 12, 18, 6, C.amber);
  px(g, 21, 18, 6, C.purple);
  px(g, 30, 18, 6, '#fff');
  g.strokeStyle = '#fff';
  g.lineWidth = 1.2;
  g.strokeRect(PX - 18.4, 18.6, 5.8, 5.8);
  g.fillStyle = '#fff';
  g.font = `600 6.5px ${MONO}`;
  spaced(g, 'PLAYER_1.EXE', PX - 26, 24, 1, 'right');

  // > PLAYER 1
  g.fillStyle = C.slate;
  g.font = `500 7px ${MONO}`;
  const lw = spaced(g, '> PLAYER 1', 12, 49, 0.5);
  g.font = `400 6.5px ${JA_GOTHIC}`;
  g.fillText('プレイヤー', 12 + lw + 6, 49);

  // portrait window: navy border + hard offset shadow
  const bx = 12, by = 56, bw = 84, bh = 112;
  g.fillStyle = 'rgba(15,23,42,.3)';
  g.fillRect(bx + 4, by + 4, bw, bh);
  g.save();
  g.beginPath();
  g.rect(bx, by, bw, bh);
  g.clip();
  if (photo) {
    drawPhoto(g, photo, bx, by, bw, bh);
  } else {
    // little game room: warm wall, checker floor, the character standing on it
    g.fillStyle = '#fdf3d6';
    g.fillRect(bx, by, bw, bh);
    const floor = by + bh - 24;
    for (let x = bx; x < bx + bw; x += 8) {
      for (let y = floor; y < by + bh; y += 8) {
        g.fillStyle = ((x - bx) / 8 + (y - floor) / 8) % 2 ? '#e2e8f0' : '#f1f5f9';
        g.fillRect(x, y, 8, 8);
      }
    }
    g.fillStyle = C.navy;
    g.fillRect(bx, floor - 1, bw, 1.5);
    // a pixel window on the wall
    g.fillStyle = '#bfdbfe';
    g.fillRect(bx + 10, by + 12, 18, 14);
    g.strokeStyle = C.navy;
    g.lineWidth = 1;
    g.strokeRect(bx + 10.5, by + 12.5, 17, 13);
    g.beginPath(); g.moveTo(bx + 19, by + 12.5); g.lineTo(bx + 19, by + 25.5); g.stroke();
    if (sprite) {
      const k = 2.75;
      const sw = sprite.width * k, sh = sprite.height * k;
      g.imageSmoothingEnabled = false;
      // soft shadow under the feet
      g.fillStyle = 'rgba(15,23,42,.18)';
      g.beginPath();
      g.ellipse(bx + bw / 2, floor + 9, 15, 3.5, 0, 0, Math.PI * 2);
      g.fill();
      g.drawImage(sprite, bx + (bw - sw) / 2, floor + 10 - sh, sw, sh);
      g.imageSmoothingEnabled = true;
    }
  }
  g.restore();
  g.strokeStyle = C.navy;
  g.lineWidth = 2;
  g.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);

  // character stats, right column
  const sx = 106, sr = PX - 12;
  g.fillStyle = C.slate;
  g.font = `600 5.5px ${MONO}`;
  spaced(g, 'CHARACTER STATS', sx, 62, 0.6);
  const valCol = [C.navy, C.purple, '#b7810c'];
  D.stats.forEach(([k, v], i) => {
    const y = 78 + i * 14;
    g.fillStyle = C.slate;
    g.font = `500 6px ${MONO}`;
    spaced(g, k, sx, y, 0.4);
    g.fillStyle = valCol[i] ?? C.navy;
    g.font = `800 6.5px ${MONO}`;
    spaced(g, v, sr, y, 0.3, 'right');
    g.fillStyle = C.grid;
    g.fillRect(sx, y + 4, sr - sx, 0.75);
  });

  // HP / MP
  g.fillStyle = C.navy;
  g.font = `800 6px ${MONO}`;
  g.fillText('HP', sx, 134);
  bar(g, sx + 14, 128, sr - sx - 14, 7, 0.86, C.amber);
  g.fillStyle = C.navy;
  g.fillText('MP', sx, 148);
  bar(g, sx + 14, 142, sr - sx - 14, 7, 0.64, C.purple);
  g.fillStyle = C.slate;
  g.font = `500 5.5px ${MONO}`;
  spaced(g, 'STATUS  ·  ONLINE', sx, 165, 0.4);
  px(g, sr - 4, 160, 4, '#10b981');

  // name in English and Japanese, with the blinking-cursor block
  const ny = 194;
  g.fillStyle = C.navy;
  g.font = `800 18px ${MONO}`;
  const [first, ...rest] = D.name.toUpperCase().split(' ');
  spaced(g, first, 12, ny, 0.8);
  const lastW = spaced(g, rest.join(' '), 12, ny + 20, 0.8);
  g.fillStyle = C.amber;
  g.fillRect(12 + lastW + 3, ny + 6, 7, 15);
  g.fillStyle = C.slate;
  g.font = `500 8.5px ${JA_GOTHIC}`;
  spaced(g, D.nameJa, 12, ny + 35, 0.8);

  // pixel corner, like the site's hero
  px(g, PX - 22, ny - 10, 4, C.purple);
  px(g, PX - 17, ny - 10, 4, C.purple);
  px(g, PX - 17, ny - 5, 4, C.purple);

  // amber band with the role in both languages
  const bh2 = 58;
  const b = PY - bh2;
  g.fillStyle = C.amber;
  g.fillRect(0, b, PX, bh2);
  g.fillStyle = C.navy;
  g.fillRect(0, b, PX, 2.5);
  g.font = `800 13.5px ${MONO}`;
  spaced(g, D.role.toUpperCase(), 12, b + 21, 0.5);
  g.font = `600 8px ${JA_GOTHIC}`;
  spaced(g, D.roleJa, 12, b + 33, 0.8);
  g.font = `600 7.5px ${MONO}`;
  g.textAlign = 'left';
  g.fillText(D.host, 12, b + 48);
  g.textAlign = 'right';
  g.fillText('▶ PRESS START', PX - 12, b + 48);
  g.textAlign = 'left';
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
    if (photo.mono) g.filter = 'grayscale(1) contrast(1.05)';
    drawPhoto(g, photo, 0, 0, PX, ph);
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

function loadPhoto(p: (typeof PHOTOS)['dev']): Promise<Photo> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ img, focus: p.focus, zoom: Math.max(1, p.zoom), mono: p.mono });
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

export async function makeTextures(): Promise<CardTextures> {
  await Promise.all(
    [`800 16px ${MONO}`, `500 16px ${MONO}`, `400 48px ${SERIF}`, `italic 400 16px ${SERIF}`, `italic 600 16px ${SERIF}`, `600 16px ${MONO}`, `400 8px ${SANS}`, `500 8px ${SANS}`].map((f) =>
      document.fonts.load(f).catch(() => undefined),
    ),
  );
  const [pd, pf, sprite] = await Promise.all([loadPhoto(PHOTOS.dev), loadPhoto(PHOTOS.frame), loadImage(PLAYER_SPRITE)]);
  const st = drawStrap();
  return {
    dev: toTexture(drawDev(pd, sprite)),
    frame: toTexture(drawFrame(pf)),
    strap: { tex: toTexture(st.canvas, true), aspect: st.aspect },
  };
}
