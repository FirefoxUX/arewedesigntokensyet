import fs from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../src/data');

/**
 * Writes a backup of design token keys from the config file to disk.
 *
 * @returns {Promise<void>}
 */
async function writeTokenBackup() {
  const backupPath = path.join(dataDir, 'tokensBackup.json');

  try {
    const json = JSON.stringify(config.designTokenKeys, null, 2);
    await fs.writeFile(backupPath, json);
    console.log('✅ Token backup written to /src/data');
  } catch (err) {
    console.error('❌ Failed to write token backup:', err);
  }
}

/**
 * Main entry point for writing a design token key backup file.
 */
async function main() {
  await writeTokenBackup();
}

// Run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
