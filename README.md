# byairu-landing

Landing page for **byairu.com**: a 3D lanyard ID card with two sides.

- Front: Rizky Khairullah, Software Engineer, styled like **dev.byairu.com**
- Back: Airu., Photographer, styled like **frame.byairu.com**

Drag the card to swing it, tap it to turn it over. The links under the card follow the side that faces you.

Stack: Astro, React island, three.js via @react-three/fiber, Rapier physics, meshline for the strap.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
```

## Editing

Everything you will usually change is in `src/config.ts`:

- names, roles and URLs of both sides, in English and Japanese
- the two card photos and how they are cropped

Photos: add `public/avatar/dev.jpg` (shown in colour, near-square slot) and `public/avatar/frame.jpg` (shown in black and white, wide slot). Until a file exists the card shows an empty photo slot. Use `focus` and `zoom` in the config to frame your face.

The feel of the lanyard (gravity, damping, strap length) is set by the constants at the top of `src/components/Lanyard.tsx`.

The card faces are drawn on a canvas in `src/lib/faces.ts` (one function per side), so layout changes happen there.

Visitors without WebGL, or with reduced motion turned on, get a static two-card version with the same links.

## Deploy (Dokploy)

The `Dockerfile` builds the site and serves it with nginx. `nginx.conf` does the domain move:

- `byairu.com/` serves this landing page
- any existing file (assets, favicon, avatars) is served normally
- every other path, such as old `/photo/...`, `/collections`, `/about` links, gets a **301 to the same path on frame.byairu.com**

So bring frame.byairu.com up first, then point byairu.com at this app.
