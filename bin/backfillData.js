import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

import config from '../config.js';
import { getGitRevision } from './updatePropagationHistory.js';
import propagationHistoryData from '../src/data/propagationHistory.json' with { type: 'json' };

const execFileAsync = promisify(execFile);

/**
 * Determines whether the specified Git repository has no pending changes.
 *
 * Executes `git status --porcelain` in the given repository directory and
 * checks if the output is empty. An empty output indicates a “clean” repo
 * (no modified, staged, or untracked files).
 *
 * @async
 * @function isGitRepoClean
 * @param {string} repoPath - Filesystem path to the Git repository to check (defaults to config.repoPath).
 * @returns {Promise<boolean>} Resolves to `true` if the repository is clean (no changes),
 *                              or `false` if there are any changes or if an error occurs.
 */
async function isGitRepoClean(repoPath = config.repoPath) {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], {
      cwd: repoPath,
    });
    return stdout.length === 0;
  } catch (error) {
    console.error(`Failed to check if repo is clean`, error);
    return false;
  }
}

/**
 * Retrieves the name of the currently checked-out Git branch.
 *
 * Executes `git branch --show-current` in the specified repository directory
 * and returns the branch name, trimmed of any surrounding whitespace.
 *
 * @async
 * @function getCurrentBranchName
 * @param {string} repoPath - Filesystem path to the Git repository (defaults to config.repoPath).
 * @returns {Promise<string|null>} Resolves to the current branch name, or
 *                                 `null` if an error occurs while executing the command.
 */
async function getCurrentBranchName(repoPath = config.repoPath) {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['branch', '--show-current'],
      {
        cwd: repoPath,
      },
    );
    return stdout.trim();
  } catch (error) {
    console.error(
      `Failed to get current branch name from git ${repoPath}`,
      error,
    );
    return null;
  }
}

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
  let startingGitBranch = null;
  let startingGitRev = null;
  try {
    if (!(await isGitRepoClean())) {
      console.log(
        `Repo at ${config.repoPath} isn't clean. Aborting. Please stash any changes and try again.`,
      );
      process.exit(1);
    }
    startingGitRev = await getGitRevision(config.repoPath);
    startingGitBranch = await getCurrentBranchName(config.repoPath);

    if (!startingGitBranch || !startingGitBranch) {
      console.log('Failed to get current revision and branch data. Aborting');
      process.exit(1);
    }

    console.log(
      `Starting script at git rev: ${startingGitRev} branch: ${startingGitBranch}`,
    );

    for (const entry of propagationHistoryData) {
      const { date, gitRevision } = entry;
      await checkoutGitRev(gitRevision);
      await runBuildDataScript();
      await runPropagationUpdateScript(date);
    }
  } catch (e) {
    throw new Error(e);
  } finally {
    if (startingGitBranch) {
      console.log('Restoring original branch');
      await checkoutGitRev(startingGitBranch);
      const currentRev = await getGitRevision(config.repoPath);
      if (currentRev != startingGitRev) {
        console.error(
          `Mismatch between the initial revision (${startingGitRev}) and the current revision (${currentRev}. Please check.`,
        );
      } else {
        console.log(
          `Starting revision ${currentRev} on branch ${startingGitBranch} successfully restored. Data backfill complete`,
        );
      }
    } else {
      console.error(
        'Error: No starting git rev captured. Check path config is correct.',
      );
    }
  }
}
