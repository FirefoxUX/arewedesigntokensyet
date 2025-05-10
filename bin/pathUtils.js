/**
 * Converts a file path to a URI-safe path (e.g., for links or JSON keys).
 *
 * @param {string} pathStr
 * @returns {string}
 */
export function convertPathToURI(pathStr) {
  return encodeURI(pathStr.replace(/\\/g, '/'));
}
