import path from 'path';
import { fileURLToPath } from 'url';

import { EleventyHtmlBasePlugin } from '@11ty/eleventy';
import eleventyAutoCacheBuster from 'eleventy-auto-cache-buster';

import loadAndAnnotateFile from './src/lib/loadAndAnnotateFile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inputDir = path.relative(__dirname, 'src/content');
const outputDir = path.relative(__dirname, 'build');

export default async function (eleventyConfig) {
  // Plugins.
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);
  eleventyConfig.addPlugin(eleventyAutoCacheBuster, {
    hashAlgorithm: 'md5',
  });

  // Files that are passed through.
  eleventyConfig.addPassthroughCopy('./src/content/fonts/');
  eleventyConfig.addPassthroughCopy('./src/content/css/');

  // Filters
  eleventyConfig.addFilter('slug', (str) =>
    str.toLowerCase().replace(/[\s/]+/g, '-'),
  );
  eleventyConfig.addFilter('rangeClass', function (number) {
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

  // Shortcodes
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
