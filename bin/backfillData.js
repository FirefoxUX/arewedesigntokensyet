import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

import config from '../config.js';
import { getGitRevision } from './updatePropagationHistory.js';
import propagationHistoryData from '../src/data/propagationHistory.json' with { type: 'json' };

const execFileAsync = promisify(execFile);

/**
 * Checks out a specific Git revision in a given repository.
 *
 * @async
 * @function checkoutGitRev
 * @param {string} revision - The Git revision (commit hash, branch, or tag) to check out.
 * @param {string} [repoPath] - The file system path to the repository. Defaults to `config.repoPath`.
 * @returns {Promise<string|null>} Resolves to the trimmed stdout from the `git checkout` command if successful; otherwise, returns `null`.
 */
async function checkoutGitRev(revision, repoPath = config.repoPath) {
  console.log(`Checking out git rev: ${revision}`);
  try {
    const { stdout } = await execFileAsync('git', ['checkout', revision], {
      cwd: repoPath,
    });
    return stdout.trim();
  } catch (error) {
    console.error(
      `Failed to checkout git revision ${revision} from ${repoPath}`,
      error,
    );
    return null;
  }
}

/**
 * Runs the npm `build:data` script in the current working directory.
 *
 * @async
 * @function runBuildDataScript
 * @returns {Promise<string|null>} Resolves to the trimmed stdout from the `npm run build:data` command if successful; otherwise, returns `null`.
 */
async function runBuildDataScript() {
  try {
    const { stdout } = await execFileAsync('npm', ['run', 'build:data']);
    return stdout.trim();
  } catch (error) {
    console.error(`Failed to run the npm build:data script`, error);
    return null;
  }
}

/**
 * Runs the propagation history update script for a given date with the `--force` flag.
 *
 * @async
 * @function runPropagationUpdateScript
 * @param {string} date - The date for which to update propagation history (format: YYYY-MM-DD).
 * @returns {Promise<string|null>} Resolves to the trimmed stdout from the `updatePropagationHistory.js` script if successful; otherwise, returns `null`.
 */
async function runPropagationUpdateScript(date) {
  try {
    const { stdout } = await execFileAsync('node', [
      'bin/updatePropagationHistory.js',
      '--force',
      '--date',
      date,
    ]);
    return stdout.trim();
  } catch (error) {
    console.error(
      `Failed to run the updatePropagationHistory.js script`,
      error,
    );
    return null;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let startingGitRev = null;
  try {
    startingGitRev = await getGitRevision(config.repoPath);
    console.log(`Starting script at git rev: ${startingGitRev}`);

    for (const entry of propagationHistoryData) {
      const { date, gitRevision } = entry;
      await checkoutGitRev(gitRevision);
      await runBuildDataScript();
      await runPropagationUpdateScript(date);
    }
  } catch (e) {
    throw new Error(e);
  } finally {
    if (startingGitRev) {
      console.log('Restoring starting rev');
      await checkoutGitRev(startingGitRev);
    } else {
      console.error(
        'Error: No starting git rev captured. Check path config is correct.',
      );
    }
  }
}
