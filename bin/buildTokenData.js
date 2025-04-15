import fs from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'node:url';

import { glob } from 'glob';
import postcss from 'postcss';

import config from '../config.js';

// Fix for __dirname not being available to es modules.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function isVariableDefinition(property) {
  return property?.startsWith('--');
}

export function isDesignTokenValue(value) {
  return config.designTokenKeys.some((item) => value?.includes(item));
}

export function isExcludedValue(value) {
  return config.excludedCSSValues.some((item) => {
    if (item instanceof RegExp) {
      return item.test(value);
    } else {
      return value === item.toString();
    }
  });
}

export function isTokenizableProperty(prop) {
  return config.designTokenProperties.includes(prop);
}

/*
 * Parse a CSS file looking for Design Tokens based on list provided from config.
 *
 * @param {string} filePath - The CSS file to process.
 */
export async function getPropagationData(filePath) {
  const foundPropValues = [];
  const foundVariables = {};
  let designTokenCount = 0;
  try {
    const css = await fs.readFile(filePath);
    const root = postcss.parse(css.toString());

    root.walk((node) => {
      const isDesignToken = isDesignTokenValue(node.value);
      const isExcluded = isExcludedValue(node.value);

      if (isTokenizableProperty(node.prop)) {
        foundPropValues.push({
          property: node.prop,
          value: node.value,
          isDesignToken,
          isExcludedValue: isExcluded,
          isIndirectRef: false,
          start: node.source.start,
          end: node.source.end,
        });

        if (isDesignToken || isExcluded) {
          designTokenCount++;
        }
      } else if (isVariableDefinition(node.prop)) {
        if (isDesignToken || isExcluded) {
          foundVariables[node.prop] = {
            value: node.value,
            isDesignToken,
            isExcludedValue: isExcluded,
            start: node.source.start,
            end: node.source.end,
          };
        }
      }
    });

    for (const decl of foundPropValues) {
      for (const variable in foundVariables) {
        if (decl.value.includes(`var(${variable})`)) {
          // Only count it now if it wasn't previously counted.
          if (decl.isDesignToken === false && decl.isExcludedValue === false) {
            designTokenCount++;
          }
          decl.isDesignToken = foundVariables[variable].isDesignToken;
          decl.isExcludedValue = foundVariables[variable].isExcludedValue;
          if (decl.isDesignToken === true || decl.isExcludedValue === true) {
            decl.isIndirectRef = true;
          }
          break;
        }
      }
    }
  } catch (e) {
    console.error(`Unable to read or parse ${filePath}`);
    throw new Error(e);
  }

  // console.log(foundPropValues.length, designTokenCount);

  const percComplete =
    foundPropValues.length > 0
      ? (100 / foundPropValues.length) * designTokenCount
      : 100;

  return {
    designTokenCount,
    foundProps: foundPropValues.length,
    percentage: +percComplete.toFixed(2), // Coerce the string returned from reducing precision with `toFixed()` back into a number.
    foundPropValues,
    foundVariables,
  };
}

/**
 * Retrieves a flat list of CSS file objects.
 *
 * @param {string} repoPath - The root directory of your repository.
 * @param {string[]} includePatterns - Glob patterns to include (relative to repoPath).
 * @param {string[]} ignorePatterns - Glob patterns to ignore.
 * @returns {Promise<Object[]>} - A flat array of objects, each representing a CSS file.
 */
async function getCssFilesList(
  repoPath,
  includePatterns = ['**/*.css'],
  ignorePatterns = [],
) {
  // Use glob to get matching files from each include pattern.
  const files = await glob(includePatterns, {
    cwd: repoPath,
    absolute: true,
    ignore: ignorePatterns,
  });

  const fileObjects = [];
  for (const file of files) {
    const relativeFilePath = path.relative(repoPath, file);
    const directory = path.dirname(relativeFilePath);
    const fileName = path.basename(file);
    const propagationData = await getPropagationData(file);
    fileObjects.push({
      fileName,
      absolutePath: file,
      relativePath: relativeFilePath,
      directory,
      propagationData,
    });
  }

  return fileObjects;
}

/**
 * Groups the CSS file objects by their directory.
 *
 * @param {Array} fileObjects - A flat array of CSS file objects.
 * @returns {Object} - An object where keys are directory paths and values are arrays of file objects.
 */
function groupFilesByDirectory(fileObjects) {
  const groupedByDir = fileObjects.reduce((groups, fileObj) => {
    // Use the directory property (an empty string indicates the repo root).
    const dir = fileObj.directory || '.';
    if (!groups[dir]) {
      groups[dir] = {};
    }
    if (!groups[dir].files) {
      groups[dir].files = [];
    }
    groups[dir].files.push(fileObj);

    return Object.fromEntries(Object.entries(groups).sort());
  }, {});

  for (const dir in groupedByDir) {
    computeAverages(groupedByDir[dir]);
  }

  return groupedByDir;
}

/**
 * Recursively computes and attaches an average propagation to each node.
 *
 * The average is computed from the propagation of files directly in the node plus those from its descendants.
 *
 * @param {Object} node - A node in the nested tree.
 * @returns {Object} - An object with the aggregated { total, count }.
 */
export function computeAverages(node) {
  let total = 0;
  let count = 0;

  for (const file of node.files) {
    if (
      file.propagationData &&
      typeof file.propagationData.percentage === 'number'
    ) {
      total += file.propagationData.percentage;
      count++;
    }
  }

  node.averagePropagation = count ? total / count : 0;
  return { total, count };
}

if (process.argv[1] === import.meta.filename) {
  (async () => {
    // console.log(await getPropagationData('../mozilla-unified/toolkit/content/widgets/moz-message-bar/moz-message-bar.css'));
    /* console.log(
      await getPropagationData(
        '../mozilla-unified/browser/components/sidebar/sidebar.css',
      ),
    ); */

    const cssFilesList = await getCssFilesList(
      config.repoPath,
      config.includePatterns,
      config.ignorePatterns,
    );
    const groupedByDir = groupFilesByDirectory(cssFilesList);

    if (groupedByDir) {
      try {
        await fs.writeFile(
          path.join(__dirname, '../src/data/groupedFilesByDir.json'),
          JSON.stringify(groupedByDir, null, 2),
        );
        await fs.writeFile(
          path.join(__dirname, '../src/data/cssFilesList.json'),
          JSON.stringify(cssFilesList, null, 2),
        );
      } catch (err) {
        console.log(err);
      }
    } else {
      console.log('No CSS files found in the specified repo path.');
    }
  })();
}
