import fs from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import config from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../src/data');

try {
  await fs.writeFile(
    path.join(dataDir, 'tokensBackup.json'),
    JSON.stringify(config.designTokenKeys, null, 2),
  );
  console.log('✅ Token backup written to /src/data');
} catch (err) {
  console.error('❌ Failed to write output files:', err);
}
