import path from 'path';
import { fileURLToPath } from 'url';

import { EleventyHtmlBasePlugin } from '@11ty/eleventy';
import eleventyAutoCacheBuster from 'eleventy-auto-cache-buster';

import loadAndAnnotateFile from './src/lib/loadAndAnnotateFile.js';
import NunjucksLib from 'nunjucks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inputDir = path.relative(__dirname, 'src/content');
const outputDir = path.relative(__dirname, 'build');

export default async function (eleventyConfig) {
  // Tell 11ty to reload if the bundle put there by esbuild changes.
  eleventyConfig.setServerOptions({
    watch: ['build/**/*.bundle.js'],
  });

  // Plugins.
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);
  eleventyConfig.addPlugin(eleventyAutoCacheBuster, {
    hashAlgorithm: 'md5',
  });

  // Files that are passed through.
  eleventyConfig.addPassthroughCopy('./src/content/fonts/');
  eleventyConfig.addPassthroughCopy('./src/content/css/');
  eleventyConfig.addPassthroughCopy({
    './src/data/propagationHistory.json': 'data/propagationHistory.json',
  });

  // Filters.
  eleventyConfig.addFilter('slug', (str) =>
    str.toLowerCase().replace(/[\s/]+/g, '-'),
  );
  eleventyConfig.addNunjucksFilter('ignoreFilter', (num) => {
    return num === -1
      ? new NunjucksLib.runtime.SafeString(
          '<span class="ignored" title="No CSS properties of interest were located within this file, so it isn\'t counted">No Props Found</span>',
        )
      : `${+num.toFixed(2)}%`;
  });
  eleventyConfig.addFilter('rangeClass', function (number) {
    number = parseInt(number.toString().replace('%', ''), 10);
    if (number >= 75 && number <= 100) {
      return 'high';
    } else if (number >= 50 && number < 75) {
      return 'medium';
    } else if (number >= 0 && number < 50) {
      return 'low';
    } else {
      return '';
    }
  });

  // Shortcodes.
  eleventyConfig.addAsyncShortcode('loadAndAnnotateFile', loadAndAnnotateFile);

  return {
    markdownTemplateEngine: 'njk',
    dir: {
      input: inputDir,
      output: outputDir,

      // The following are relative to the input dir.
      data: '../data/',
      includes: '../includes/',
      layouts: '../layouts/',
    },
  };
}
