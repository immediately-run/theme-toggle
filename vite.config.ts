import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The theme switcher (`widget.theme`, HOST_THEMING_SPEC §8.2): the R3-501
// two-state toggle upgraded in place. https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // R3-834: the tests read document.documentElement (the polarity effect).
    environment: 'jsdom',
  },
});
