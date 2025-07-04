import path from 'path';
import { glob } from 'glob';
import { getPropagationData } from './propagationUtils.js';

/**
 * Converts a file path to a URI-safe path (e.g., for links or JSON keys).
 * @param {string} pathStr
 * @returns {string}
 */
export function convertPathToURI(pathStr) {
  return encodeURI(pathStr.replace(/\\/g, '/'));
}

/**
 * Retrieves a flat list of CSS file objects with propagation analysis data.
 * @param {string} repoPath - Root of the project repo.
 * @param {object} [options]
 * @param {string[]} [options.includePatterns] - Glob include patterns.
 * @param {string[]} [options.ignorePatterns] - Glob ignore patterns.
 * @param {Function} [options.__glob] - Glob implementation (mockable for testing).
 * @returns {Promise<object[]>} - List of file metadata + propagation info.
 */
export async function getCssFilesList(
  repoPath,
  { includePatterns = ['**/*.css'], ignorePatterns = [], __glob = glob } = {},
) {
  const files = await __glob(includePatterns, {
    cwd: repoPath,
    absolute: true,
    ignore: ignorePatterns,
  });

  const fileObjects = [];

  for (const file of files) {
    const relativePath = path.relative(repoPath, file);
    const fileURI = convertPathToURI(relativePath);
    const dirURI = convertPathToURI(path.dirname(relativePath));
    const fileName = path.basename(file);

    const propagationData = await getPropagationData(file);

    fileObjects.push({
      fileName,
      absolutePath: file,
      fileURI,
      dirURI,
      propagationData,
    });
  }

  return fileObjects;
}
