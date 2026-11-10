// Everything you are likely to edit lives here.

export const SITES = {
  dev: {
    name: 'Rizky Khairullah',
    nameJa: 'リズキ・ハイルッラー',
    role: 'Software Engineer',
    roleJa: 'ソフトウェアエンジニア',
    url: 'https://dev.byairu.com',
    host: 'dev.byairu.com',
  },
  frame: {
    name: 'Airu.',
    nameJa: 'アイル',
    role: 'Photographer',
    roleJa: '写真家',
    url: 'https://frame.byairu.com',
    host: 'frame.byairu.com',
  },
} as const;

export type Side = keyof typeof SITES;

/**
 * Card photos. Drop the files in /public/avatar and they are used automatically.
 * Until a file exists, the card shows an empty photo slot.
 *
 * focus: which point of the photo stays in frame, 0..1 from the left / top (0.5, 0.5 = center).
 * zoom:  1 = fill the slot, 1.5 = crop in 50% tighter.
 *
 * dev   -> shown in colour, slot is close to square (132 x 142)
 * frame -> shown in black and white, slot is wide (212 x 176)
 */
export const PHOTOS = {
  dev: { src: '/avatar/dev.jpg', focus: [0.5, 0.35] as [number, number], zoom: 1 },
  frame: { src: '/avatar/frame.jpg', focus: [0.5, 0.4] as [number, number], zoom: 1 },
};
