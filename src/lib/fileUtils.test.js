import fs from 'node:fs/promises';
import path from 'path';
import { getCssFilesList, convertPathToURI } from './fileUtils.js';

describe('convertPathToURI', () => {
  test('converts windows-style paths to URI-safe format', () => {
    const result = convertPathToURI('src\\styles\\main.css');
    expect(result).toBe('src/styles/main.css');
  });

  test('encodes special characters', () => {
    const result = convertPathToURI('src/some dir/file name.css');
    expect(result).toBe('src/some%20dir/file%20name.css');
  });
});

describe('getCssFilesList', () => {
  const fakeRepo = '/fake/repo';

  afterEach(() => {
    vi.resetAllMocks();
  });

  beforeEach(() => {
    vi.mock('node:fs/promises');
    fs.writeFile = vi.fn();
    fs.readFile = vi.fn();
  });

  test('returns css file objects as expected', async () => {
    const fakeCSS = `.test {
      width: 100px;
      background-color: var(--whatever);
      gap: --space-xsmall;
      color: transparent;
    }`;

    fs.readFile.mockResolvedValue(fakeCSS);

    const mockFiles = [
      path.join(fakeRepo, 'styles/reset.css'),
      path.join(fakeRepo, 'components/button.css'),
    ];

    const result = await getCssFilesList(fakeRepo, {
      includePatterns: ['**/*.css'],
      ignorePatterns: [],
      __glob: vi.fn(() => mockFiles),
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('fileName', 'reset.css');
    expect(result[0]).toHaveProperty('propagationData.percentage');
    expect(result[1].fileName).toBe('button.css');
    expect(result[1].dirURI).toBe('components');
  });
});
