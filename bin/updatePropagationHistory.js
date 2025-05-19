import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import config from '../config.js';

import total from '../src/data/totals.js';

const HISTORY_PATH = path.join('./src/data', 'propagationHistory.json');

const execFileAsync = promisify(execFile);

async function getGitRevision(repoPath) {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd: config.repoPath,
    });
    return stdout.trim();
  } catch (error) {
    console.error(`Failed to get git revision from ${repoPath}`, error);
    return null;
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    date: new Date().toISOString().slice(0, 10),
    force: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--date') {
      options.date = args[i + 1];
      i++;
    } else if (arg === '--force') {
      options.force = true;
    }
  }

  return options;
}

function calculateDelta(history, date, newPercentage) {
  // Get the most recent entry before the given date
  const previous = [...history]
    .filter((entry) => entry.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  if (!previous) {
    return null;
  }

  return +(newPercentage - previous.percentage).toFixed(2);
}

export async function updatePropagationHistory({ date, force }) {
  let history = [];

  try {
    const file = await fs.readFile(HISTORY_PATH, 'utf-8');
    history = JSON.parse(file);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }

  const newPercentage = total().totalAveragePropagation;
  const delta = calculateDelta(history, date, newPercentage);
  const gitRevision = await getGitRevision();

  const newEntry = { date, percentage: newPercentage };

  if (gitRevision !== null) {
    newEntry.gitRevision = gitRevision;
  }

  if (delta !== null) {
    newEntry.delta = delta;
  }

  const existingIndex = history.findIndex((entry) => entry.date === date);

  if (existingIndex !== -1 && !force) {
    console.log(
      `⚠ Entry for ${date} already exists. Use --force to overwrite.`,
    );
    return;
  }

  if (existingIndex !== -1 && force) {
    history[existingIndex] = newEntry;
    console.log(
      `✏ Overwrote entry for ${date}: ${newPercentage}% (Δ ${delta ?? 'n/a'})`,
    );
  } else {
    history.push(newEntry);
    console.log(
      `✔ Added entry for ${date}: ${newPercentage}% (Δ ${delta ?? 'n/a'})`,
    );
  }

  history.sort((a, b) => a.date.localeCompare(b.date));
  await fs.writeFile(HISTORY_PATH, JSON.stringify(history, null, 2));
}

// Run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv);
  updatePropagationHistory(options);
}
