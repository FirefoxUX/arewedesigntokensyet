import fs from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../src/data');

/**
 * Writes a backup of design token properties from the config file to disk.
 * @returns {Promise<void>}
 */
async function writePropsBackup() {
  const backupPath = path.join(dataDir, 'propsBackup.json');

  try {
    const json = JSON.stringify(config.designTokenProperties, null, 2);
    await fs.writeFile(backupPath, json);
    console.log('✅ Token props written to /src/data');
  } catch (err) {
    console.error('❌ Failed to write props backup:', err);
  }
}

/**
 * Main entry point for writing a design token props backup file.
 */
async function main() {
  await writePropsBackup();
}

// Run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
