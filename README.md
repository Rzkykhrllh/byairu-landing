# byairu-landing

Landing page for **byairu.com**: a 3D lanyard ID card with two sides.

- Front: Rizky Khairullah, Software Engineer, styled like **dev.byairu.com**
- Back: Airu., Photographer, styled like **frame.byairu.com**

Drag the card to swing it, throw it, tap it to turn it over. The strap twists as the card turns. The links under the card follow the side that faces you.

Stack: Astro, React island, three.js via @react-three/fiber, Rapier physics. The strap is a ribbon mesh rebuilt each frame from the rope bodies.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321 (or the next free port)
npm run build    # static output in dist/
```

## Editing

Everything you will usually change is in `src/config.ts`:

- names, roles and URLs of both sides, in English and Japanese
- the two card photos and how they are cropped

Photos: the engineer side shows the Airu sprite in `public/avatar/airu-idle.webp` (or `public/avatar/dev.jpg` if it exists). The photographer side shows the cut-out portrait `public/avatar/airu-camera.webp` (made from `airu.png`, which stays out of the repo) on a studio backdrop. Use `focus` and `zoom` in the config to frame your face. `CARD_FINISH` sets the card surface (matte, glossy, holo).

## How the lanyard moves

All of it lives in `src/components/Lanyard.tsx`, with the knobs at the top of the file.

- **Bodies.** A fixed point above the screen, four rope points, and the card, joined by rope joints (a maximum length, so the strap can go slack) and a ball joint at the clamp.
- **Forces.** Gravity swings the card. The only extra force is a torsion spring that turns the card to the chosen side, like the strap's twist (`TURN_STIFF`, `TURN_DAMP`). It runs once per physics step (fixed 1/60s), so the feel is the same on 60Hz and 120Hz screens.
- **Drag and throw.** While held, the card follows the pointer. Past the strap's length it is held back by a rubber band that gives at most `STRAP_STRETCH`. On release it keeps the speed of the last ~90ms of the drag (capped by `THROW_MAX`). A press that barely moves is a tap and turns the card over.
- **Rest.** Once the card settles, the physics bodies fall asleep and nothing is rendered until something moves again (on-demand rendering), so an idle page costs no battery.
- **Fit.** The camera moves back just enough for the hanging card to clear the links under it and keep side margins, for any window shape.

The card faces are drawn on a canvas in `src/lib/faces.ts` (one function per side), so layout changes happen there.

## Tokyo time

The page follows the clock in Tokyo (`CLOCK` in `src/config.ts`):

- **Street.** Behind the sprite on the engineer side is a pixel Tokyo street (`src/lib/scene.ts`): the sky, lights and Tokyo Tower change with the hour, the tree and what is in the air with the season (sakura, summer fireworks, autumn maple, falling snow in winter).
- **Night.** From 20:00 the page goes dark; from 00:00 to 04:00 the room lights go off and the cursor becomes a flashlight.
- **Picker.** The time in the top-left corner opens a slider for the hour and icons for the season, so visitors can see any of them. `?hour=22&month=4` in the URL does the same.
- **All scenes.** On the dev server, `/scenes` shows every hour and month side by side (it is not part of the built site).

## Deploy

`Dockerfile` builds the static site and serves it with nginx (`nginx.conf`): the landing page at `/`, long-cached hashed assets, and every other unknown path redirected to the same path on frame.byairu.com (old photo-site URLs). In Dokploy, use the Dockerfile build type and expose port 80.

Visitors without WebGL, or with reduced motion turned on, get a static two-card version with the same links.

## Deploy (Dokploy)

The `Dockerfile` builds the site and serves it with nginx. `nginx.conf` does the domain move:

- `byairu.com/` serves this landing page
- any existing file (assets, favicon, avatars) is served normally
- every other path, such as old `/photo/...`, `/collections`, `/about` links, gets a **301 to the same path on frame.byairu.com**

So bring frame.byairu.com up first, then point byairu.com at this app.
