// Everything you are likely to edit lives here.

export const SITES = {
  dev: {
    name: 'Rizky Khairullah',
    nameJa: 'リズキ・ハイルッラー',
    role: 'Software Engineer',
    roleJa: 'ソフトウェアエンジニア',
    url: 'https://dev.byairu.com',
    host: 'dev.byairu.com',
    // the essentials, from dev.byairu.com
    experience: '3+ years',
    location: 'Yokohama, Japan',
    stack: ['Python', 'Django', 'FastAPI', 'TypeScript', 'Vue', 'Docker'],
  },
  frame: {
    name: 'Airu.',
    nameJa: 'アイル',
    role: 'Photographer',
    roleJa: '写真家',
    url: 'https://frame.byairu.com',
    host: 'frame.byairu.com',
    camera: 'Fujifilm X-S20',
    location: 'Tokyo',
  },
} as const;

export type Side = keyof typeof SITES;

/**
 * Card pictures. Files live in /public/avatar.
 *
 * player: the pixel character on the engineer side (Airu, from the anniversary book sprites).
 *         If /avatar/dev.jpg exists it is used instead, as a regular photo.
 * frame:  the full-bleed photo on the photographer side. Until the file exists the card shows an empty slot.
 *
 * focus: which point of the photo stays in frame, 0..1 from the left / top (0.5, 0.5 = center).
 * zoom:  1 = fill the slot, 1.5 = crop in 50% tighter.
 * mono:  true = show the photo in black and white.
 * cutout: true = the photo has no background (PNG/WebP with transparency); a backdrop is drawn behind it.
 */
export const PLAYER_SPRITE = '/avatar/airu-idle.webp';

export const PHOTOS = {
  dev: { src: '/avatar/dev.jpg', focus: [0.5, 0.35] as [number, number], zoom: 1, mono: false, cutout: false },
  // a cut-out (transparent background) on a soft studio backdrop; focus x = the point of the photo
  // (0..1) that lines up with the strap
  frame: { src: '/avatar/airu-camera.webp', focus: [0.5, 0] as [number, number], zoom: 1, mono: true, cutout: true },
};

/**
 * Card surface.
 * matte  -> soft satin sheen, no sharp reflections
 * glossy -> laminated, catches a bright highlight as it swings
 * holo   -> laminated with a holographic shimmer
 */
export const CARD_FINISH: 'matte' | 'glossy' | 'holo' = 'glossy';

/**
 * Your clock. The page reads the time where you are (not the visitor's):
 * night  -> the lights go down and the cursor becomes a flashlight, [from, to) in hours
 * asleep -> the status in the corner says you are asleep
 * Preview any hour with ?hour=22 in the URL.
 */
export const CLOCK = {
  timeZone: 'Asia/Tokyo',
  label: 'JST',
  night: [19, 6] as [number, number],
  asleep: [1, 7] as [number, number],
};
