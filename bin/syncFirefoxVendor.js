import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * Environment variable pointing at the Firefox checkout to vendor from.
 * @type {string | undefined}
 */
const FIREFOX_ROOT = process.env.FIREFOX_ROOT || '../firefox';

if (!FIREFOX_ROOT) {
  throw new Error('FIREFOX_ROOT is required');
}

/**
 * Absolute path to the current project root.
 * @type {string}
 */
const PROJECT_ROOT = process.cwd();

/**
 * Destination root for vendored Firefox files.
 * @type {string}
 */
const VENDOR_ROOT = path.join(PROJECT_ROOT, 'src/vendor/firefox');

/**
 * Path to the generated metadata file.
 * @type {string}
 */
const METADATA_PATH = path.join(VENDOR_ROOT, 'vendor-metadata.json');

/**
 * Firefox paths to vendor into this project.
 * These are relative to the Firefox repository root.
 * @type {string[]}
 */
const PATHS_TO_COPY = [
  'tools/lint/stylelint/stylelint-plugin-mozilla',
  'toolkit/themes/shared/design-system/dist/tokens-table.mjs',
  'toolkit/themes/shared/design-system/dist/semantic-categories.mjs',
];

/**
 * Expected branch for vendoring.
 * @type {string}
 */
const EXPECTED_BRANCH = 'main';

/**
 * Allowed Git remote URLs for the Firefox repository.
 * Extend this list if your local checkout uses a different canonical remote.
 * @type {string[]}
 */
const ALLOWED_REMOTE_URLS = [
  'https://github.com/mozilla-firefox/firefox.git',
  'https://github.com/mozilla-firefox/firefox',
  'git@github.com:mozilla-firefox/firefox.git',
];

/**
 * Run a Git command and return trimmed stdout.
 *
 * @param {string[]} args - Git command arguments.
 * @param {string} cwd - Working directory for the command.
 * @returns {string}
 */
function runGit(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/**
 * Check whether a path exists.
 *
 * @param {string} targetPath - Path to test.
 * @returns {boolean}
 */
function pathExists(targetPath) {
  return fs.existsSync(targetPath);
}

/**
 * Ensure a directory exists.
 *
 * @param {string} targetPath - Directory path to create.
 * @returns {void}
 */
function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

/**
 * Remove a file or directory if it exists.
 *
 * @param {string} targetPath - Path to remove.
 * @returns {void}
 */
function removeIfExists(targetPath) {
  if (pathExists(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

/**
 * Return true if childPath is strictly inside parentPath.
 *
 * @param {string} parentPath - Parent directory.
 * @param {string} childPath - Candidate child path.
 * @returns {boolean}
 */
function isInside(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return (
    relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
  );
}

/**
 * Copy a file or directory recursively, rejecting symlinks.
 *
 * Symlinks are refused so the script cannot silently copy files from outside
 * the expected source tree via a linked path.
 *
 * @param {string} src - Source path.
 * @param {string} dest - Destination path.
 * @returns {void}
 */
function copyRecursive(src, dest) {
  const stat = fs.lstatSync(src);

  if (stat.isSymbolicLink()) {
    throw new Error(`Refusing to copy symlink: ${src}`);
  }

  if (stat.isDirectory()) {
    if (path.basename(src) === 'node_modules') {
      return;
    }
    ensureDir(dest);
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }

  if (!stat.isFile()) {
    throw new Error(`Unsupported file type while copying: ${src}`);
  }

  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

/**
 * Collect repository metadata for the current HEAD.
 *
 * @param {string} repoPath - Repository root.
 * @returns {{
 *   revision: string,
 *   revisionDate: string,
 *   branch: string,
 *   originUrl: string,
 *   originRevision: string | null
 * }}
 */
function getRepoInfo(repoPath) {
  const revision = runGit(['rev-parse', 'HEAD'], repoPath);
  const revisionDate = runGit(['show', '-s', '--format=%cI', 'HEAD'], repoPath);
  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath);
  const originUrl = runGit(['remote', 'get-url', 'origin'], repoPath);

  /** @type {string | null} */
  let originRevision = null;

  if (branch !== 'HEAD') {
    try {
      originRevision = runGit(['rev-parse', `origin/${branch}`], repoPath);
    } catch {
      originRevision = null;
    }
  }

  const data = {
    revision,
    revisionDate,
    branch,
    originUrl,
    originRevision,
  };

  return data;
}

/**
 * Ensure the repository working tree is clean.
 *
 * Fails if there are unstaged or staged but uncommitted changes.
 *
 * @param {string} repoPath - Repository root.
 * @returns {void}
 */
function assertCleanWorkingTree(repoPath) {
  try {
    execFileSync('git', ['diff', '--quiet'], {
      cwd: repoPath,
      stdio: 'ignore',
    });
    execFileSync('git', ['diff', '--cached', '--quiet'], {
      cwd: repoPath,
      stdio: 'ignore',
    });
  } catch {
    throw new Error(
      'Firefox repo has uncommitted changes. Refusing to vendor from a dirty working tree.',
    );
  }
}

/**
 * Ensure the repository origin URL matches one of the allowed remotes.
 *
 * @param {string} originUrl - Git remote origin URL.
 * @returns {void}
 */
function assertAllowedRemote(originUrl) {
  if (!ALLOWED_REMOTE_URLS.includes(originUrl)) {
    throw new Error(
      [
        `Unexpected git remote origin: ${originUrl}`,
        'Refusing to vendor from an unrecognised repository.',
      ].join('\n'),
    );
  }
}

/**
 * Validate repository state against expected constraints.
 *
 * @param {{
 *   branch: string,
 *   revision: string,
 *   originRevision: string | null
 * }} repoInfo - Repository metadata.
 * @returns {void}
 */
function assertValidRepoState(repoInfo) {
  if (repoInfo.branch === 'HEAD') {
    throw new Error(
      'Repository is in a detached HEAD state. Refusing to vendor.',
    );
  }

  if (repoInfo.branch !== EXPECTED_BRANCH) {
    throw new Error(
      `Expected branch "${EXPECTED_BRANCH}" but found "${repoInfo.branch}". Refusing to vendor.`,
    );
  }

  if (!repoInfo.originRevision) {
    throw new Error(
      `Could not determine origin/${repoInfo.branch}. Make sure the remote branch exists and has been fetched.`,
    );
  }

  if (repoInfo.revision !== repoInfo.originRevision) {
    throw new Error(
      [
        `Local branch "${repoInfo.branch}" is not in sync with origin/${repoInfo.branch}.`,
        `Local:  ${repoInfo.revision}`,
        `Remote: ${repoInfo.originRevision}`,
      ].join('\n'),
    );
  }
}

/**
 * Validate that each requested source path exists and stays within the repo.
 *
 * @param {string} repoRoot - Canonical repository root.
 * @param {string[]} relativePaths - Relative paths to validate.
 * @returns {void}
 */
function validateSourcePaths(repoRoot, relativePaths) {
  for (const relativePath of relativePaths) {
    const absolutePath = path.resolve(repoRoot, relativePath);

    if (!pathExists(absolutePath)) {
      throw new Error(`Source path does not exist: ${relativePath}`);
    }

    if (absolutePath !== repoRoot && !isInside(repoRoot, absolutePath)) {
      throw new Error(`Source path escapes repository root: ${relativePath}`);
    }
  }
}

/**
 * Main entry point.
 *
 * @returns {void}
 */
function main() {
  const firefoxRoot = fs.realpathSync(path.resolve(FIREFOX_ROOT));

  if (!pathExists(path.join(firefoxRoot, '.git'))) {
    throw new Error(
      `FIREFOX_ROOT does not look like a git repo: ${firefoxRoot}`,
    );
  }

  const repoInfo = getRepoInfo(firefoxRoot);

  assertAllowedRemote(repoInfo.originUrl);
  assertCleanWorkingTree(firefoxRoot);
  assertValidRepoState(repoInfo);
  validateSourcePaths(firefoxRoot, PATHS_TO_COPY);

  removeIfExists(VENDOR_ROOT);
  ensureDir(VENDOR_ROOT);

  for (const relativePath of PATHS_TO_COPY) {
    const sourcePath = path.resolve(firefoxRoot, relativePath);
    const destinationPath = path.join(VENDOR_ROOT, relativePath);
    copyRecursive(sourcePath, destinationPath);
  }

  const metadata = {
    sourceRepo: 'mozilla-firefox/firefox',
    originUrl: repoInfo.originUrl,
    revision: repoInfo.revision,
    revisionDate: repoInfo.revisionDate,
    branch: repoInfo.branch,
    paths: PATHS_TO_COPY,
    syncedAt: new Date().toISOString(),
  };

  fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2) + '\n');

  console.log(
    `Vendored Firefox files into ${path.relative(PROJECT_ROOT, VENDOR_ROOT)}`,
  );
  console.log(
    `Wrote metadata to ${path.relative(PROJECT_ROOT, METADATA_PATH)}`,
  );
  console.log(`Revision: ${metadata.revision}`);
}

main();
