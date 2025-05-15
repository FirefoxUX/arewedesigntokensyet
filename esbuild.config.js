import { context } from 'esbuild';

const watchMode = process.argv.includes('--watch');

const ctx = await context({
  entryPoints: ['./src/components/main.js'],
  bundle: true,
  format: 'esm',
  outfile: './build/components/awdty.bundle.js',
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
