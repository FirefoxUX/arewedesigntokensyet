import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import config from '../config.js';

import total from '../src/data/totals.js';

// Note: This data is committed to the repo. It is updated monthly.
const HISTORY_PATH = path.join('./src/data', 'propagationHistory.json');
// Note: This latest data is not committed.
const HISTORY_PATH_LATEST = path.join(
  './src/data',
  'propagationHistoryLatest.json',
);
// The day of the month to append an entry if --monthly is passed.
const DAY_OF_MONTH = 1;

const execFileAsync = promisify(execFile);

/**
 * Retrieves the current Git commit SHA (revision) from the given repository path.
 * @param {string} repoPath - The path to the local Git repository.
 * @returns {Promise<string|null>} - A promise that resolves to the Git commit SHA (as a string),
 *   or `null` if the command fails.
 * @example
 * const sha = await getGitRevision('/path/to/repo');
 * console.log(sha); // e.g., 'a1b2c3d4...'
 */
async function getGitRevision(repoPath) {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd: repoPath,
    });
    return stdout.trim();
  } catch (error) {
    console.error(`Failed to get git revision from ${repoPath}`, error);
    return null;
  }
}

/**
 * A map of supported command-line options with their metadata.
 *
 * Each key represents a long-form CLI flag (e.g., '--force').
 * The associated value describes how to parse and display that option.
 *
 * @typedef {object} ParsedOptions
 * @property {string} date - The date string in YYYY-MM-DD format.
 * @property {boolean} force - Whether the --force flag was passed.
 * @property {boolean} latestOnly - Whether the --latest-only flag was passed.
 * @property {boolean} monthly - Whether the --monthly flag was passed.
 *
 */
const optionDefinitions = {
  '--date': {
    type: 'string',
    description: 'Specify a date (default: today)',
    default: new Date().toISOString().slice(0, 10),
    requiresValue: true,
  },
  '--force': {
    type: 'boolean',
    description:
      'Force re-processing of data. Does not apply when passing --latest-only.',
    default: false,
  },
  '--latest-only': {
    type: 'boolean',
    key: 'latestOnly',
    description: `Process only the most recent entry. Note --force is ignored and this always writes out to ${HISTORY_PATH_LATEST}`,
    default: false,
  },
  '--monthly': {
    type: 'boolean',
    description: `Enable monthly processing mode. Exits early if the day ofr the month doesn't match ${DAY_OF_MONTH}`,
    default: false,
  },
  '--help': {
    type: 'boolean',
    description: 'Show this help message',
    default: false,
  },
};

/**
 * Parses command-line arguments and returns a normalized options object.
 *
 * Recognized options are defined in `optionDefinitions`.
 * The returned object uses camelCased keys (without the `--` prefix).
 * If `--help` is passed, the help text is printed and the process exits.
 * @param {string[]} argv - The full `process.argv` array from the Node.js runtime.
 * @returns {ParsedOptions} - Parsed CLI options with defaults applied.
 * @example
 * // node script.js --date 2024-01-01 --force
 * const options = parseArgs(process.argv);
 * // options = { date: '2024-01-01', force: true, latestOnly: false, monthly: false }
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {};

  for (const [flag, def] of Object.entries(optionDefinitions)) {
    if (def.key === undefined) {
      def.key = flag.slice(2);
    }
    options[def.key] = def.default;
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const def = optionDefinitions[arg];

    if (!def) {
      continue;
    }

    if (arg === '--help') {
      printHelp();
      process.exit(0);
    }

    const key = optionDefinitions[arg]?.key || arg.slice(2);
    if (def.type === 'boolean') {
      options[key] = true;
    } else if (def.requiresValue) {
      options[key] = args[i + 1];
      i++;
    }
  }

  return options;
}

/**
 * Prints usage instructions for all supported CLI options to stdout.
 */
function printHelp() {
  console.log('Usage: node script.js [options]\n');
  console.log('Options:');
  for (const [flag, def] of Object.entries(optionDefinitions)) {
    console.log(`  ${flag.padEnd(18)} ${def.description}`);
  }
}

/**
 * Calculates the percentage delta between the given `newPercentage` and the most recent
 * historical entry before the specified `date`.
 *
 * The function looks through the `history` array, finds the latest entry before `date`,
 * and returns the difference between `newPercentage` and that entry's `percentage`,
 * rounded to two decimal places.
 * @param {{ date: string, percentage: number }[]} history - Array of historical entries,
 *   each with a `date` (ISO 8601 format) and `percentage`.
 * @param {string} date - The cutoff date (ISO string) to compare against.
 * @param {number} newPercentage - The new percentage value to compare to the historical one.
 * @returns {number|null} - The difference in percentage (rounded to 2 decimal places),
 *   or `null` if no prior entry exists.
 * @example
 * calculateDelta([
 *   { date: '2024-01-01', percentage: 10 },
 *   { date: '2024-02-01', percentage: 15 }
 * ], '2024-03-01', 18);
 * // Returns: 3
 */
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

/**
 * Determines whether history update should be skipped in monthly mode
 * based on whether the provided date matches the configured day of the month.
 *
 * @param {string} date - ISO date string (YYYY-MM-DD).
 * @param {boolean} monthly - Whether monthly mode is enabled.
 * @returns {boolean} - true if the update should be skipped.
 */
function shouldSkipForMonthly(date, monthly) {
  if (!monthly) {
    return false;
  }
  const dayOfMonth = new Date(date).getDate();
  return dayOfMonth !== parseInt(DAY_OF_MONTH, 10);
}

/**
 * Reads and parses a JSON file. Returns an empty array if the file doesn't exist.
 *
 * @param {string} path - Path to the JSON file.
 * @returns {Promise<any[]>} - Parsed contents of the file, or an empty array.
 */
async function readJsonFile(path) {
  try {
    const file = await fs.readFile(path, 'utf-8');
    return JSON.parse(file);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

/**
 * Writes a JavaScript object to a file as formatted JSON.
 *
 * @param {string} path - Path to the JSON file.
 * @param {any} data - Data to serialize and write.
 * @returns {Promise<void>}
 */
async function writeJsonFile(path, data) {
  await fs.writeFile(path, JSON.stringify(data, null, 2));
}

/**
 * Constructs a new history entry from provided data.
 *
 * @param {string} date - Date string (YYYY-MM-DD).
 * @param {number} percentage - Average propagation percentage.
 * @param {number|null} delta - Delta from previous entry, if any.
 * @param {string|null} gitRevision - Git revision hash, if available.
 * @returns {{ date: string, percentage: number, delta?: number, gitRevision?: string }}
 */
function buildNewEntry(date, percentage, delta, gitRevision) {
  const entry = { date, percentage };
  if (delta !== null) {
    entry.delta = delta;
  }
  if (gitRevision !== null) {
    entry.gitRevision = gitRevision;
  }
  return entry;
}

/**
 * Updates or inserts a new entry into the history array.
 * Logs the outcome and respects the --force flag.
 *
 * @param {Array} history - Existing array of entries.
 * @param {object} newEntry - The new history entry to insert.
 * @param {string} date - Date associated with the entry.
 * @param {boolean} force - Whether to allow overwriting existing entries.
 * @returns {Array|null} - The updated history array, or null if no update was performed.
 */
function updateHistory(history, newEntry, date, force) {
  const existingIndex = history.findIndex((entry) => entry.date === date);
  history.sort((a, b) => a.date.localeCompare(b.date));

  if (existingIndex !== -1 && !force) {
    console.log(
      `⚠ Entry for ${date} already exists. Use --force to overwrite.`,
    );
    return null;
  }

  if (existingIndex !== -1) {
    history[existingIndex] = newEntry;
    console.log(
      `✏ Overwrote entry for ${date}: ${newEntry.percentage}% (Δ ${newEntry.delta ?? 'n/a'})`,
    );
  } else {
    history.push(newEntry);
    console.log(
      `✔ Added entry for ${date}: ${newEntry.percentage}% (Δ ${newEntry.delta ?? 'n/a'})`,
    );
  }

  return history;
}

/**
 * Updates the design token propagation history file(s) with the latest data.
 *
 * Supports full history writes or a latest-only mode. Respects a monthly mode
 * that limits writes to a configured day of the month. Includes Git revision
 * and delta changes where available.
 *
 * @param {object} params - Configuration options.
 * @param {string} params.date - ISO date string (YYYY-MM-DD).
 * @param {boolean} params.force - Whether to overwrite an existing entry.
 * @param {boolean} params.latestOnly - Whether to write to the latest-only file.
 * @param {boolean} params.monthly - Whether to restrict writing to one day per month.
 * @returns {Promise<void>}
 */
export async function updatePropagationHistory({
  date,
  force,
  latestOnly,
  monthly,
}) {
  if (shouldSkipForMonthly(date, monthly)) {
    console.log(
      `⚠ The arg --monthly was passed but the day of the month doesn't match "${DAY_OF_MONTH}".`,
    );
    return;
  }

  const history = await readJsonFile(HISTORY_PATH);
  const newPercentage = total().totalAveragePropagation;
  const delta = calculateDelta(history, date, newPercentage);
  const gitRevision = await getGitRevision(config.repoPath);
  const newEntry = buildNewEntry(date, newPercentage, delta, gitRevision);

  if (!latestOnly) {
    const updatedHistory = updateHistory(history, newEntry, date, force);
    if (updatedHistory !== null) {
      await writeJsonFile(HISTORY_PATH, updatedHistory);
    }
  } else {
    console.log(
      `✔ Wrote latest entry for ${date}: ${newPercentage}% (Δ ${delta ?? 'n/a'})`,
    );
    await writeJsonFile(HISTORY_PATH_LATEST, [newEntry]);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv);
  await updatePropagationHistory(options);
}
