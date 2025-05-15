import { build } from 'esbuild';

build({
  entryPoints: ['src/components/token-tooltip.js'],
  bundle: true,
  format: 'esm',
  outfile: 'build/components/token-tooltip.bundle.js',
  sourcemap: true,
  minify: true,
  target: 'es2020',
}).catch(() => process.exit(1));
