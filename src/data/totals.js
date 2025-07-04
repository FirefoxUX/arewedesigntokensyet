import groupedFilesByDir from './groupedFilesByDir.json' with { type: 'json' };

/**
 * Calculates the average propagation percentage across all directories.
 * Iterates over the `groupedFilesByDir` global object, summing each directory's
 * `averagePropagation` value and dividing by the number of entries. Returns the
 * result rounded to two decimal places.
 * @returns {{ totalAveragePropagation: number }} An object containing the average propagation percentage.
 */
export default function () {
  let total = 0;
  let count = 0;
  for (const dir in groupedFilesByDir) {
    total += groupedFilesByDir[dir].averagePropagation;
    count++;
  }

  return { totalAveragePropagation: +(total / count).toFixed(2) };
}
