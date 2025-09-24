import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      exclude: [
        '**/node_modules/**',
        'build/**',
        'src/data/**',
        'testing/**',
        '**/{esbuild,eslint,eleventy,vitest}.config.*',
        'jest**',
      ],
    },
    onConsoleLog: (log) => {
      if (log.includes('Lit is in dev mode.')) {
        return false;
      }
      if (log.includes('as token source')) {
        return false;
      }
    },
  },
});
