// Everything you are likely to edit lives here.

export const SITES = {
  dev: {
    name: 'Rizky Khairullah',
    role: 'Software Engineer',
    url: 'https://dev.byairu.com',
    host: 'dev.byairu.com',
  },
  frame: {
    name: 'Airu.',
    role: 'Photographer',
    url: 'https://frame.byairu.com',
    host: 'frame.byairu.com',
  },
} as const;

export type Side = keyof typeof SITES;

/**
 * Avatar on the card.
 * - 'pixel' : pixel-art character (no photo needed)
 * - 'mono'  : monogram (>_ and A)
 * - 'image' : real photos from /public/avatar (falls back to 'pixel' if missing)
 *
 * Preview any mode without editing: add ?avatar=pixel | mono | image to the URL.
 */
export type AvatarMode = 'pixel' | 'mono' | 'image';

export const AVATAR = {
  mode: 'pixel' as AvatarMode,
  images: {
    dev: '/avatar/dev.jpg', // colour, portrait crop works best (about 132x142 ratio)
    frame: '/avatar/frame.jpg', // shown in black and white, wide crop (about 212x176 ratio)
  },
};

export function resolveAvatarMode(): AvatarMode {
  const p = new URLSearchParams(window.location.search).get('avatar');
  return p === 'pixel' || p === 'mono' || p === 'image' ? p : AVATAR.mode;
}
