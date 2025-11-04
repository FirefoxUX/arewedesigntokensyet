import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const USAGE_PATH = path.join(ROOT, 'src', 'data', 'tokenUsage.json');

/**
 * Return a new array sorted by count (desc), tiebreaker by key asc.
 * @param {Record<string, number>} rec
 * @returns {Array<[string, number]>}
 */
function entriesSortedDesc(rec) {
  /** @type {Array<[string, number]>} */
  const arr = Object.entries(rec);
  arr.sort((a, b) => {
    if (b[1] === a[1]) {
      return a[0].localeCompare(b[0]);
    }
    return b[1] - a[1];
  });
  return arr;
}

/**
 * Stable sort by count with alphabetical tiebreaker.
 * @param {Array<{ token: string, count: number }>} rows
 * @param {'asc'|'desc'} dir
 */
function sortByCountStable(rows, dir) {
  const factor = dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    if (a.count === b.count) {
      return a.token.localeCompare(b.token);
    }
    return factor * (a.count - b.count);
  });
}

/**
 * Builds sorted lists of design tokens based on their usage counts.
 *
 * Reads token usage data from `USAGE_PATH`, parses it, and returns
 * two sorted arrays: one in descending order (most used first) and
 * one in ascending order (least used first).
 *
 * @returns {object} An object containing sorted token lists:
 * - `tokensByCountDesc` {Array<{ token: string, count: number }>} Tokens sorted by descending usage count.
 * - `tokensByCountAsc` {Array<{ token: string, count: number }>} Tokens sorted by ascending usage count.
 */
export default function () {
  /** @type {{ byToken: Record<string, { count: number, files?: Record<string, number>, descriptors?: Record<string, number> }> }} */
  const usage = JSON.parse(fs.readFileSync(USAGE_PATH, 'utf8'));

  /** @type {Array<{ token: string, count: number, files: Array<[string, number]>, descriptors: Array<[string, number]> }>} */
  const base = Object.entries(usage.byToken).map(([token, v], i) => {
    const id = String(i);
    return {
      id,
      token,
      count: v.total,
      files: entriesSortedDesc(v.files || {}),
      descriptors: entriesSortedDesc(v.descriptors || {}),
    };
  });

  const tokensByCountDesc = base.slice();
  sortByCountStable(tokensByCountDesc, 'desc');

  const tokensByCountAsc = base.slice();
  sortByCountStable(tokensByCountAsc, 'asc');

  // exposed to templates as {{ tokenLists.tokensByCountDesc }} etc
  return {
    tokensByCountDesc,
    tokensByCountAsc,
  };
}
