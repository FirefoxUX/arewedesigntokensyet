import { context } from 'esbuild';

const watchMode = process.argv.includes('--watch');

const ctx = await context({
  entryPoints: [
    './src/content/js/files.js',
    './src/content/js/render-graph.js',
    './src/content/js/NonTokenValues.js',
    './src/content/js/details-state.js',
  ],
  assetNames: '[name]',
  bundle: true,
  format: 'esm',
  outdir: './build/js/',
  sourcemap: true,
  minify: true,
  target: 'es2020',
});

if (watchMode) {
  console.log('Esbuild: 👀 Watching...');
  await ctx.watch();
} else {
  await ctx.rebuild();
  console.log('Esbuild: ✅ Build complete');
  ctx.dispose();
}
