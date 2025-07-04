import { groupFilesByDirectory, computeAverages } from './groupingUtils.js';

describe('groupFilesByDirectory', () => {
  test('groups files by directory and computes average', () => {
    const input = [
      {
        fileName: 'a.css',
        dirURI: 'components',
        propagationData: { percentage: 50 },
      },
      {
        fileName: 'b.css',
        dirURI: 'components',
        propagationData: { percentage: 100 },
      },
      {
        fileName: 'root.css',
        dirURI: '',
        propagationData: { percentage: 75 },
      },
    ];

    const grouped = groupFilesByDirectory(input);

    expect(Object.keys(grouped)).toEqual(['.', 'components']);
    expect(grouped['components'].files.length).toBe(2);
    expect(grouped['components'].averagePropagation).toBe(75);
    expect(grouped['.'].averagePropagation).toBe(75);
    expect(grouped['.'].files[0].fileName).toBe('root.css');
  });
});

describe('computeAverages', () => {
  test('computes average correctly', () => {
    const node = {
      files: [
        { propagationData: { percentage: 20 } },
        { propagationData: { percentage: 80 } },
        { propagationData: { percentage: -1 } },
      ],
    };

    const result = computeAverages(node);

    expect(result).toEqual({
      total: 100,
      count: 2,
      ignoreCount: 1,
      processedCount: 3,
    });
    expect(node.averagePropagation).toBe(50);
  });

  test('returns -1 average if no valid percentages', () => {
    const node = {
      files: [
        { propagationData: { percentage: null } },
        { propagationData: {} },
      ],
    };

    const result = computeAverages(node);

    expect(result).toEqual({
      total: 0,
      count: 0,
      ignoreCount: 2,
      processedCount: 2,
    });
    expect(node.averagePropagation).toBe(-1);
  });
});
