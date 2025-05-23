/**
 * Groups a flat list of file objects by their directory (dirURI).
 * @param {object[]} fileObjects - List of analyzed CSS file objects.
 * @returns {object} - Directory groupings with average propagation attached.
 */
export function groupFilesByDirectory(fileObjects) {
  const grouped = {};

  for (const file of fileObjects) {
    const dir = file.dirURI || '.';
    if (!grouped[dir]) {
      grouped[dir] = { files: [] };
    }
    grouped[dir].files.push(file);
  }

  // Sort and compute averages
  const sortedGrouped = Object.fromEntries(
    Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)),
  );

  for (const dir in sortedGrouped) {
    computeAverages(sortedGrouped[dir]);
  }

  return sortedGrouped;
}

/**
 * Computes the average token propagation percentage for all files in the group.
 * @param {object} node - A group of files under a single directory.
 * @returns {{ total: number, count: number }}
 */
export function computeAverages(node) {
  let total = 0;
  let count = 0;
  let processedCount = 0;
  let ignoreCount = 0;

  for (const file of node.files) {
    const pct = file?.propagationData?.percentage;
    // -1 represents a percentage to ignore.
    if (typeof pct === 'number' && pct !== -1) {
      total += pct;
      count++;
    } else {
      ignoreCount++;
    }
    processedCount++;
  }

  if (processedCount === ignoreCount && ignoreCount > 0) {
    node.averagePropagation = -1;
  } else {
    node.averagePropagation = count ? total / count : 0;
  }
  return { total, count, processedCount, ignoreCount };
}
