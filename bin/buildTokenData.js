import fs from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import config from '../config.js';
import { getCssFilesList } from '../src/lib/fileUtils.js';
import { groupFilesByDirectory } from '../src/lib/groupingUtils.js';

// Support __dirname in ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const cssFilesList = await getCssFilesList(config.repoPath, {
    includePatterns: config.includePatterns,
    ignorePatterns: config.ignorePatterns,
  });

  const groupedByDir = groupFilesByDirectory(cssFilesList);

  if (groupedByDir) {
    const dataDir = path.join(__dirname, '../src/data');

    try {
      await fs.writeFile(
        path.join(dataDir, 'groupedFilesByDir.json'),
        JSON.stringify(groupedByDir, null, 2),
      );
      await fs.writeFile(
        path.join(dataDir, 'cssFilesList.json'),
        JSON.stringify(cssFilesList, null, 2),
      );

      console.log('✅ Data written to /src/data');
    } catch (err) {
      console.error('❌ Failed to write output files:', err);
    }
  } else {
    console.log('⚠️ No CSS files found in the specified repo path.');
  }
}

// Only run if this file is executed directly (not imported)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
