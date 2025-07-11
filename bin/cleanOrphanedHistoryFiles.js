import fs from 'fs';
import { fileURLToPath } from 'url';

import { rimraf } from 'rimraf';

import propagationHistoryData from '../src/data/propagationHistory.json' with { type: 'json' };

/**
 * Removes orphaned `propagationHistory.json` files under `src/data`.
 *
 * This function determines the most recent date from the global `propagationHistoryData`,
 * then uses `rimraf` with a filter to delete any `propagationHistory.json` files that:
 *   1. Are empty
 *   2. Contain invalid JSON
 *   3. Contain an array whose last entry’s `date` does not match the latest date
 *
 * @function removeOrphanedJSON
 * @returns {void}
 */
function removeOrphanedJSON() {
  const lastDate = propagationHistoryData.at(-1).date;

  rimraf('src/data/**/propagationHistory.json', {
    glob: true,
    filter: (filePath, stats) => {
      if (!stats.isFile()) {
        return false;
      }

      const raw = fs.readFileSync(filePath, 'utf-8').trim();
      if (!raw) {
        console.log(`Deleting ${filePath}. Reason: empty file.`);
        return true;
      }

      // Invalid JSON?
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        console.log(`Deleting ${filePath}. Reason: invalid JSON.`);
        return true;
      }

      // Bogus data? Or no date matching last date for global file, suggest relevant code has been deleted or moved.
      if (!Array.isArray(data) || data.at(-1).date !== lastDate) {
        console.log(
          `Deleting ${filePath}. Reason: bogus data, or no matching date for ${lastDate}`,
        );
        return true;
      }

      // otherwise, keep the file
      return false;
    },
  });
}

// Only run if this file is executed directly (not imported)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  removeOrphanedJSON();
}
