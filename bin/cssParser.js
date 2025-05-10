import fs from 'node:fs/promises';
import postcss from 'postcss';

/**
 * Reads a CSS file and returns a PostCSS root node.
 *
 * @param {string} filePath - Absolute path to the CSS file.
 * @returns {Promise<import('postcss').Root>}
 */
export async function parseCSS(filePath) {
  const cssBuffer = await fs.readFile(filePath);
  return postcss.parse(cssBuffer.toString());
}
