import fs from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import config from '../config.js';
import { getCssFilesList } from '../src/lib/fileUtils.js';
import { groupFilesByDirectory } from '../src/lib/groupingUtils.js';

// Support __dirname in ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Retrieves and groups CSS files by directory from the configured repo path.
 *
 * @returns {Promise<{ cssFilesList: string[], groupedByDir: Record<string, string[]> }>}
 */
async function getGroupedCssFiles() {
  const cssFilesList = await getCssFilesList(config.repoPath, {
    includePatterns: config.includePatterns,
    ignorePatterns: config.ignorePatterns,
  });

  const groupedByDir = groupFilesByDirectory(cssFilesList);
  return { cssFilesList, groupedByDir };
}

/**
 * Writes grouped CSS file data to disk under /src/data.
 *
 * @param {string[]} cssFilesList - List of all matched CSS file paths.
 * @param {Object} groupedByDir - Files grouped by their containing directory.
 * @returns {Promise<void>}
 */
async function writeGroupedDataToDisk(cssFilesList, groupedByDir) {
  const dataDir = path.join(__dirname, '../src/data');

  await fs.writeFile(
    path.join(dataDir, 'groupedFilesByDir.json'),
    JSON.stringify(groupedByDir, null, 2),
  );

  await fs.writeFile(
    path.join(dataDir, 'cssFilesList.json'),
    JSON.stringify(cssFilesList, null, 2),
  );
}

/**
 * Main entry point for generating and writing grouped CSS file metadata.
 *
 * Reads CSS file paths, groups them by directory, and writes two JSON files
 * to disk: one for the raw file list and one for the grouped structure.
 *
 * Logs status and errors to the console.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const { cssFilesList, groupedByDir } = await getGroupedCssFiles();

  if (!groupedByDir || Object.keys(groupedByDir).length === 0) {
    console.log('⚠️ No CSS files found in the specified repo path.');
    return;
  }

  try {
    await writeGroupedDataToDisk(cssFilesList, groupedByDir);
    console.log('✅ Data written to /src/data');
  } catch (err) {
    console.error('❌ Failed to write output files:', err);
  }
}

// Only run if this file is executed directly (not imported)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
