import fs from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'node:url';

import { glob } from 'glob';
import { minimatch } from 'minimatch';
import postcss from 'postcss';

import config from '../config.js';

// Fix for __dirname not being available to es modules.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function isVariableDefinition(property) {
  return !!property?.startsWith?.('--');
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

export function convertPathToURI(path) {
  return encodeURI(path.replace(/\\/g, '/'));
}

async function parseCSS(filePath) {
  const css = await fs.readFile(filePath);
  return postcss.parse(css.toString());
}

export async function getVars(filePath) {
  const root = await parseCSS(filePath);
  const cssVars = {};

  root.walk((node) => {
    const isDesignToken = isDesignTokenValue(node.value);
    const isExcluded = isExcludedValue(node.value);
    if (isVariableDefinition(node.prop)) {
      cssVars[node.prop] = {
        value: node.value,
        isDesignToken,
        isExcludedValue: isExcluded,
        isIndirectRef: true,
        isExternal: true,
        src: filePath,
      };
    }
  });

  return cssVars;
}

/*
 * Parse a CSS file looking for Design Tokens based on list provided from config.
 *
 * @param {string} filePath - The CSS file to process.
 */
export async function getPropagationData(filePath) {
  const foundPropValues = [];
  let foundVariables = {};

  // If filePath matches a glob in externalFileMapping
  // process the paths listed in the config and collect vars to be used
  // to find other design token usage later.
  for (const filePathPattern in config.externalVarMapping) {
    if (minimatch(filePath, `**/${filePathPattern}`)) {
      // console.debug(`matched ${filePath}`);
      for (const externalFilePath of config.externalVarMapping[
        filePathPattern
      ]) {
        const extFilePath = path.resolve(
          path.join(config.repoPath, externalFilePath),
        );
        if (filePath === extFilePath) {
          // console.debug(`Skipping ${extFilePath}`);
          continue;
        }
        const extVars = await getVars(extFilePath);
        foundVariables = { ...foundVariables, ...extVars };
      }
    }
  }

  let designTokenCount = 0;
  try {
    const root = await parseCSS(filePath);

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
        foundVariables[node.prop] = {
          value: node.value,
          isDesignToken,
          isExcludedValue: isExcluded,
          isIndirectRef: true,
          start: node.source.start,
          end: node.source.end,
        };
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
          decl.isExternalVar = foundVariables[variable].isExternal;
          decl.isIndirectRef = foundVariables[variable].isIndirectRef;
          decl.externalVarValue = foundVariables[variable].value;
          if (decl.isExternalVar) {
            decl.externalVarSrc = foundVariables[variable].src;
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
 * Retrieves a flat list of CSS file objects based on provided glob patterns.
 *
 * @param {string} repoPath - The root directory of the repository to search within.
 * @param {Object} [options] - Optional settings for file matching.
 * @param {string[]} [options.includePatterns=['**\/*.css']] - Glob patterns to include (relative to repoPath).
 * @param {string[]} [options.ignorePatterns=[]] - Glob patterns to exclude from results.
 * @param {Function} [options.__glob=glob] - Custom glob function, useful for testing or mocking.
 * @returns {Promise<Object[]>} - A promise that resolves to a flat array of CSS file objects.
 */
export async function getCssFilesList(
  repoPath,
  { includePatterns = ['**/*.css'], ignorePatterns = [], __glob = glob } = {},
) {
  // Use glob to get matching files from each include pattern.
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

/**
 * Groups the CSS file objects by their directory.
 *
 * @param {Array} fileObjects - A flat array of CSS file objects.
 * @returns {Object} - An object where keys are directory paths and values are arrays of file objects.
 */
function groupFilesByDirectory(fileObjects) {
  const groupedByDir = fileObjects.reduce((groups, fileObj) => {
    // Use the directory property (an empty string indicates the repo root).
    const dir = fileObj.dirURI || '.';
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
    const cssFilesList = await getCssFilesList(config.repoPath, {
      includePatterns: config.includePatterns,
      ignorePatterns: config.ignorePatterns,
    });
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
