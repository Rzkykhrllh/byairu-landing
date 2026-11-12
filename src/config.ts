// Everything you are likely to edit lives here.

export const SITES = {
  dev: {
    name: 'Rizky Khairullah',
    nameJa: 'リズキ・ハイルッラー',
    role: 'Software Engineer',
    roleJa: 'ソフトウェアエンジニア',
    url: 'https://dev.byairu.com',
    host: 'dev.byairu.com',
    // character stats, as on dev.byairu.com
    stats: [
      ['CLASS', 'ENGINEER'],
      ['EXP', '3+ YRS'],
      ['FUEL', '1000+ COFFEE'],
    ] as const,
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
 * player: the pixel character on the engineer side (drawn crisp, no smoothing).
 *         If /avatar/dev.jpg exists it is used instead, as a regular photo.
 * frame:  the full-bleed photo on the photographer side. Until the file exists the card shows an empty slot.
 *
 * focus: which point of the photo stays in frame, 0..1 from the left / top (0.5, 0.5 = center).
 * zoom:  1 = fill the slot, 1.5 = crop in 50% tighter.
 * mono:  true = show the photo in black and white.
 */
export const PLAYER_SPRITE = '/avatar/player.png';

export const PHOTOS = {
  dev: { src: '/avatar/dev.jpg', focus: [0.5, 0.35] as [number, number], zoom: 1, mono: false },
  frame: { src: '/avatar/frame.jpg', focus: [0.5, 0.5] as [number, number], zoom: 1, mono: false },
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
