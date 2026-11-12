import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

/** Pages that only exist on the dev server, never in the built site. */
const devPages = {
  name: 'dev-pages',
  hooks: {
    'astro:config:setup': ({ command, injectRoute }) => {
      if (command !== 'dev') return;
      injectRoute({ pattern: '/scenes', entrypoint: './src/dev/scenes.astro' }); // every Tokyo street scene
    },
  },
};

export default defineConfig({
  site: 'https://byairu.com',
  integrations: [react(), devPages],
});
