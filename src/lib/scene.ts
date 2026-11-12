// A small pixel-art Tokyo street behind the engineer sprite. It follows Airu's clock: the sky,
// buildings and lights change with the hour, and the season decides what is in the air
// (sakura, summer leaves and fireworks, autumn maple, snow). One drawn pixel = one card pixel,
// so it matches the sprite's pixel size.

type G = CanvasRenderingContext2D;

export type Phase = 'night' | 'dawn' | 'morning' | 'day' | 'golden' | 'dusk';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export function phaseOf(hour: number): Phase {
  if (hour >= 20 || hour < 4) return 'night';
  if (hour < 6) return 'dawn';
  if (hour < 9) return 'morning';
  if (hour < 16) return 'day';
  if (hour < 18) return 'golden';
  return 'dusk';
}

export function seasonOf(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

/** Sky bands top to bottom, far and near buildings, ground, and how lit the windows are. */
const LOOK: Record<Phase, { sky: string[]; far: string; near: string; ground: string; lit: number; haze: string }> = {
  night: { sky: ['#0b1026', '#10183a', '#16204a', '#1e2a58'], far: '#1f2849', near: '#141a33', ground: '#2a2f45', lit: 0.45, haze: 'rgba(255,190,120,.10)' },
  dawn: { sky: ['#2f3f78', '#6d68a6', '#d898a8', '#f5c3a0'], far: '#6a6a93', near: '#3e3f63', ground: '#8a8295', lit: 0.2, haze: 'rgba(255,200,170,.18)' },
  morning: { sky: ['#78bdee', '#9fd0f4', '#c9e5f6', '#eaf4f6'], far: '#a9bfd3', near: '#7d93aa', ground: '#c9c6c0', lit: 0, haze: 'rgba(255,255,255,.18)' },
  day: { sky: ['#4c9fe6', '#6fb5ee', '#97caf2', '#c3e0f5'], far: '#9db6cc', near: '#6e86a0', ground: '#c4c1bb', lit: 0, haze: 'rgba(255,255,255,.12)' },
  golden: { sky: ['#5c7fc2', '#d99a6c', '#f2bd7a', '#fadca3'], far: '#b08f86', near: '#7b6470', ground: '#cdb39a', lit: 0.08, haze: 'rgba(255,190,110,.2)' },
  dusk: { sky: ['#272150', '#55397a', '#a8577a', '#e5866a'], far: '#4c3f6a', near: '#2d2748', ground: '#5f566e', lit: 0.35, haze: 'rgba(255,150,120,.14)' },
};

const dark = (p: Phase) => p === 'night' || p === 'dusk';

/** Small seeded random, so the same hour always draws the same street. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draw the street into the box (x, y, w, h). `floor` is the y of the pavement's top edge,
 * where the sprite stands.
 */
export function drawTokyo(g: G, x: number, y: number, w: number, h: number, floor: number, hour: number, month: number) {
  const phase = phaseOf(hour);
  const season = seasonOf(month);
  const L = LOOK[phase];
  const r = rng(month * 31 + hour);
  const px = (X: number, Y: number, W = 1, H = 1) => g.fillRect(Math.round(X), Math.round(Y), W, H);

  // ---- sky, in hard bands like a pixel game ----
  const skyH = floor - y;
  L.sky.forEach((c, i) => {
    g.fillStyle = c;
    const a = y + Math.round((skyH * i) / L.sky.length);
    const b = y + Math.round((skyH * (i + 1)) / L.sky.length);
    g.fillRect(x, a, w, b - a);
  });

  // ---- stars, sun, moon ----
  if (phase === 'night' || phase === 'dusk') {
    for (let i = 0; i < (phase === 'night' ? 26 : 10); i++) {
      g.fillStyle = r() > 0.75 ? '#ffffff' : 'rgba(255,255,255,.55)';
      px(x + r() * w, y + r() * skyH * 0.55);
    }
  }
  if (phase === 'night') {
    // crescent moon
    g.fillStyle = '#f6efc9';
    for (const [dx, dy, W] of [[1, 0, 3], [0, 1, 5], [0, 2, 5], [0, 3, 5], [1, 4, 3]] as const) px(x + w - 13 + dx, y + 5 + dy, W);
    g.fillStyle = L.sky[0];
    for (const [dx, dy, W] of [[3, 0, 2], [3, 1, 3], [3, 2, 3], [3, 3, 3], [3, 4, 1]] as const) px(x + w - 13 + dx, y + 5 + dy, W);
  } else if (phase === 'day' || phase === 'morning') {
    g.fillStyle = '#fff6c8';
    px(x + w - 14, y + 6, 5, 5);
    px(x + w - 15, y + 7, 7, 3);
    px(x + w - 13, y + 5, 3, 7);
  } else if (phase === 'golden' || phase === 'dawn') {
    // big low sun: it sets in the west, right over Fuji's peak, and rises in the east
    g.fillStyle = phase === 'golden' ? '#ffd58a' : '#ffc9a8';
    const sx = phase === 'golden' ? x + 16 : x + w - 30, sy = phase === 'golden' ? floor - 33 : floor - 30;
    px(sx + 2, sy, 6, 1); px(sx + 1, sy + 1, 8, 1); px(sx, sy + 2, 10, 4); px(sx + 1, sy + 6, 8, 1); px(sx + 2, sy + 7, 6, 1);
  }

  // ---- Mt Fuji far away, on the clear days of the cold half of the year ----
  if (season !== 'summer') {
    const fx = x + 6, base = floor - 14, fw = 30, fh = 12;
    for (let i = 0; i < fh; i++) {
      const half = 2 + Math.round(((fw / 2 - 2) * i) / fh);
      g.fillStyle = i < (season === 'autumn' ? 2 : 4) ? (dark(phase) ? '#9aa3c4' : '#f4f7fb') : dark(phase) ? '#2a3360' : '#7f95bf';
      px(fx + fw / 2 - half, base - fh + i, half * 2);
    }
  }

  // ---- far skyline, with Tokyo Tower ----
  g.fillStyle = L.far;
  for (let bx = x; bx < x + w; ) {
    const bw = 4 + Math.floor(r() * 6);
    const bh = 10 + Math.floor(r() * 16);
    g.fillRect(bx, floor - bh, bw, bh);
    if (L.lit > 0) {
      for (let wy = floor - bh + 2; wy < floor - 2; wy += 3)
        for (let wx = bx + 1; wx < bx + bw - 1; wx += 2)
          if (r() < L.lit * 0.6) { g.fillStyle = 'rgba(255,214,140,.7)'; px(wx, wy); g.fillStyle = L.far; }
    }
    bx += bw;
  }
  tower(g, x + w - 16, floor, 38, phase);

  // ---- near buildings, lower and darker, with lit windows after dark ----
  for (let bx = x - 2; bx < x + w; ) {
    const bw = 7 + Math.floor(r() * 7);
    const bh = 6 + Math.floor(r() * 12);
    g.fillStyle = L.near;
    g.fillRect(bx, floor - bh, bw, bh);
    if (season === 'winter') { g.fillStyle = dark(phase) ? '#aeb6d0' : '#f4f7fb'; g.fillRect(bx, floor - bh - 1, bw, 1); }
    for (let wy = floor - bh + 2; wy < floor - 1; wy += 3)
      for (let wx = bx + 1; wx < bx + bw - 1; wx += 2) {
        if (L.lit > 0 && r() < L.lit) g.fillStyle = r() > 0.3 ? '#ffd27a' : '#9ad8ff';
        else if (L.lit === 0 && r() < 0.5) g.fillStyle = 'rgba(255,255,255,.22)';
        else continue;
        px(wx, wy);
      }
    bx += bw + (r() > 0.7 ? 1 : 0);
  }

  // haze over the skyline: warm city glow at night, light air by day
  const hz = g.createLinearGradient(0, floor - 24, 0, floor);
  hz.addColorStop(0, 'rgba(0,0,0,0)');
  hz.addColorStop(1, L.haze);
  g.fillStyle = hz;
  g.fillRect(x, floor - 24, w, 24);

  // ---- pavement ----
  const snowy = season === 'winter';
  g.fillStyle = snowy ? (dark(phase) ? '#8d96b4' : '#eef2f7') : L.ground;
  g.fillRect(x, floor, w, y + h - floor);
  g.fillStyle = 'rgba(0,0,0,.18)';
  g.fillRect(x, floor, w, 1); // kerb
  g.fillStyle = 'rgba(0,0,0,.07)';
  for (let tx = x + 5; tx < x + w; tx += 7) g.fillRect(tx, floor + 1, 1, y + h - floor - 1);
  g.fillRect(x, floor + 8, w, 1);

  // a vending machine on the corner, very Tokyo; it glows after dark
  vending(g, x + w - 10, floor, phase);

  // a street tree on the left, dressed for the season
  tree(g, x + 7, floor, season, phase, r);

  // ---- what the season puts in the air (winter snow falls live, see Snow in Lanyard.tsx) ----
  if (season === 'spring') {
    g.fillStyle = dark(phase) ? '#c98aa0' : '#f9c6d4';
    for (let i = 0; i < 12; i++) px(x + r() * w, y + 8 + r() * (h - 14), r() > 0.5 ? 2 : 1, 1);
    for (let i = 0; i < 7; i++) px(x + r() * 24, floor + 2 + r() * (y + h - floor - 3), 2, 1); // petals on the pavement
  } else if (season === 'summer') {
    if (phase === 'night' && month >= 7) firework(g, x + w * 0.42, y + 14, r);
  } else if (season === 'autumn') {
    for (let i = 0; i < 9; i++) {
      g.fillStyle = r() > 0.5 ? '#e0662f' : '#f2b13e';
      px(x + r() * w, y + 10 + r() * (h - 14), 2, 1);
    }
    g.fillStyle = '#d9692f';
    for (let i = 0; i < 8; i++) px(x + r() * 30, floor + 2 + r() * (y + h - floor - 3), 2, 1);
  }

  // night: the whole scene sits a little deeper so the sprite pops
  if (phase === 'night') {
    g.fillStyle = 'rgba(8,12,30,.18)';
    g.fillRect(x, y, w, h);
  }
}

/** Tokyo Tower: a tapering lattice in red and white bands, lit orange at night. */
function tower(g: G, cx: number, floor: number, H: number, phase: Phase) {
  const night = dark(phase);
  for (let i = 0; i < H; i++) {
    const t = i / H; // 0 at the top
    const half = Math.round(0.5 + 4.5 * Math.pow(t, 1.6));
    const band = Math.floor(i / 5) % 2 === 0;
    g.fillStyle = night ? (band ? '#ff9a4a' : '#e8742c') : band ? '#e5452e' : '#f3ece4';
    g.fillRect(cx - half, floor - H + i, half * 2 + 1, 1);
    // lattice: hollow middle on the wide part
    if (half > 2 && i % 2 === 0) {
      g.fillStyle = night ? 'rgba(20,10,30,.55)' : 'rgba(120,40,30,.35)';
      g.fillRect(cx - half + 2, floor - H + i, half * 2 - 3, 1);
    }
  }
  // the two observation decks
  g.fillStyle = night ? '#ffe2a8' : '#f3ece4';
  g.fillRect(cx - 2, floor - Math.round(H * 0.52), 5, 2);
  g.fillRect(cx - 1, floor - Math.round(H * 0.78), 3, 1);
  // antenna light
  g.fillStyle = night ? '#ff5a4a' : '#d9d2c8';
  g.fillRect(cx, floor - H - 3, 1, 3);
}

/** Multiply a hex colour, to shade or darken it. */
function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

const CANOPY: Record<Exclude<Season, 'winter'>, [string, string, string]> = {
  // light, mid, dark
  spring: ['#fde1ea', '#f6b3c7', '#d97f9c'],
  summer: ['#86c96a', '#4f9e4c', '#2f6e3a'],
  autumn: ['#f6c24e', '#ea7a2c', '#b8442a'],
};

/**
 * A street tree standing on the pavement at `cx`: trunk, two limbs and a round, shaded canopy
 * with a dark outline, so it reads as a tree at a glance. In winter it is bare, with snow on the limbs.
 */
function tree(g: G, cx: number, floor: number, season: Season, phase: Phase, r: () => number) {
  const night = dark(phase) ? 0.55 : phase === 'dawn' ? 0.8 : 1;
  const bark = shade('#5a3f2e', night), barkDark = shade('#3b281d', night);
  const top = floor - 26; // where the trunk splits

  // trunk with a shaded side and a little root flare
  g.fillStyle = bark;
  g.fillRect(cx - 1, top, 3, floor - top);
  g.fillRect(cx - 2, floor - 2, 5, 2);
  g.fillStyle = barkDark;
  g.fillRect(cx + 1, top, 1, floor - top);
  // limbs
  g.fillStyle = bark;
  for (let i = 0; i < 9; i++) g.fillRect(cx - 1 - i, top - Math.round(i * 0.9), 2, 1);
  for (let i = 0; i < 8; i++) g.fillRect(cx + 1 + i, top - Math.round(i * 1.1), 2, 1);
  for (let i = 0; i < 7; i++) g.fillRect(cx, top - 2 - i * 2, 1, 2);

  if (season === 'winter') {
    // bare twigs, each carrying a line of snow
    const twigs: [number, number, number, number][] = [[-9, -8, -4, -5], [8, -9, 3, -5], [0, -16, -3, -4], [0, -16, 3, -3]];
    for (const [sx, sy, dx, dy] of twigs) {
      for (let i = 0; i <= 4; i++) {
        const tx = cx + sx + Math.round((dx * i) / 4), ty = top + sy + Math.round((dy * i) / 4);
        g.fillStyle = bark;
        g.fillRect(tx, ty, 1, 1);
        g.fillStyle = dark(phase) ? '#c7cde0' : '#ffffff';
        g.fillRect(tx, ty - 1, 1, 1);
      }
    }
    g.fillStyle = dark(phase) ? '#c7cde0' : '#ffffff';
    g.fillRect(cx - 9, top - 9, 3, 1);
    g.fillRect(cx + 7, top - 10, 3, 1);
    return;
  }

  // canopy: a few overlapping blobs, lit from the upper left, with a dark rim
  const [light, mid, deep] = CANOPY[season].map((c) => shade(c, night));
  const blobs: [number, number, number][] = [[cx, top - 12, 10], [cx - 8, top - 6, 7], [cx + 8, top - 7, 7], [cx + 2, top - 3, 7]];
  const inside = (px: number, py: number) => blobs.some(([bx, by, br]) => (px - bx) ** 2 + (py - by) ** 2 <= br * br);
  for (let py = top - 23; py <= top + 4; py++)
    for (let px = cx - 16; px <= cx + 16; px++) {
      if (!inside(px, py)) continue;
      const edge = !inside(px - 1, py) || !inside(px + 1, py) || !inside(px, py - 1) || !inside(px, py + 1);
      const lightness = -(px - cx) * 0.06 - (py - (top - 12)) * 0.09 + (r() - 0.5) * 0.5;
      g.fillStyle = edge ? deep : lightness > 0.45 ? light : lightness < -0.55 ? deep : mid;
      g.fillRect(px, py, 1, 1);
    }
  // flecks: blossoms in spring, light through the leaves otherwise
  g.fillStyle = season === 'spring' ? shade('#ffffff', night) : light;
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, d = r() * 9;
    const fx = Math.round(cx + Math.cos(a) * d), fy = Math.round(top - 11 + Math.sin(a) * d * 0.8);
    if (inside(fx, fy)) g.fillRect(fx, fy, 1, 1);
  }
}

/** A summer firework: a ring of dots and a bright centre. */
function firework(g: G, cx: number, cy: number, r: () => number) {
  const cols = ['#ff6b8b', '#ffd36b', '#7fe0ff'];
  const col = cols[Math.floor(r() * cols.length)];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    for (const d of [3, 6]) {
      g.fillStyle = d === 3 ? '#ffffff' : col;
      g.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), 1, 1);
    }
  }
}

/** A vending machine on the pavement. */
function vending(g: G, x: number, floor: number, phase: Phase) {
  const night = dark(phase);
  if (night) {
    g.fillStyle = 'rgba(190,230,255,.22)';
    g.fillRect(x - 2, floor - 13, 11, 15);
  }
  g.fillStyle = night ? '#dff2ff' : '#e9eef3';
  g.fillRect(x, floor - 11, 7, 11);
  g.fillStyle = '#c0392b';
  g.fillRect(x, floor - 11, 7, 2);
  const cans = ['#e74c3c', '#2e86de', '#27ae60', '#f39c12'];
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < 3; i++) {
      g.fillStyle = cans[(row * 3 + i) % cans.length];
      g.fillRect(x + 1 + i * 2, floor - 8 + row * 3, 1, 2);
    }
  g.fillStyle = '#34495e';
  g.fillRect(x + 1, floor - 2, 5, 1);
}
