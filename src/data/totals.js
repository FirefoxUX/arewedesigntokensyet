import groupedFilesByDir from './groupedFilesByDir.json' with { type: 'json' };

export default function() {
  let total = 0;
  let count = 0;
  for (const dir in groupedFilesByDir) {
    total += groupedFilesByDir[dir].averagePropagation;
    count++;
  }

  return { totalAveragePropagation: +(total / count).toFixed(2) };
}


