// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://picknmix.mary-louise.com',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
