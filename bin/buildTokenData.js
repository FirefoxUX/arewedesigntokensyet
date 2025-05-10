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

export function containsDesignTokenValue(value) {
  return config.designTokenKeys.some((item) => value?.includes(item));
}

export function containsExcludedValue(value) {
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

function getVarData(node, { isExternal = false, filePath = null } = {}) {
  const containsDesignToken = containsDesignTokenValue(node.value);
  const containsExcluded = containsExcludedValue(node.value);
  const data = {
    value: node.value,
    containsDesignToken,
    containsExcludedValue: containsExcluded,
    isIndirectRef: true,
    isExternal,
    start: node.source.start,
    end: node.source.end,
  };
  if (isExternal && filePath) {
    data.src = filePath;
  }
  return data;
}

export async function getExternalVars(filePath) {
  const root = await parseCSS(filePath);
  const cssVars = {};

  root.walk((node) => {
    if (isVariableDefinition(node.prop) && isWithinValidParentSelector(node)) {
      cssVars[node.prop] = getVarData(node, { isExternal: true, filePath });
    }
  });

  return cssVars;
}

function isWithinValidParentSelector(node) {
  const selectorRegExp = /(?:^:root$|^:host$)/i;
  const parent = node.parent;
  return (
    parent.type === 'rule' &&
    parent.selector.split(',').some((item) => selectorRegExp.test(item))
  );
}

/**
 * From: https://searchfox.org/mozilla-central/rev/9305025f453b8eedbd0bd38c87c54be73e3cd064/devtools/client/inspector/rules/utils/utils.js#314-336
 * Returns an array of CSS variables used in a CSS property value.
 * If no CSS variables are used, returns an empty array.
 *
 * @param {String} propertyValue
 *        CSS property value (e.g. "1px solid var(--color, blue)")
 * @return {Array}
 *         List of variable names (e.g. ["--color"])
 *
 */
function getCSSVariables(propertyValue = '') {
  const variables = [];
  const parts = propertyValue.split(/var\(\s*--/);

  if (parts.length) {
    // Skip first part. It is the substring before the first occurence of "var(--"
    for (let i = 1; i < parts.length; i++) {
      // Split the part by any of the following characters expected after a variable name:
      // comma, closing parenthesis or whitespace.
      // Take just the first match. Anything else is either:
      // - the fallback value, ex: ", blue" from "var(--color, blue)"
      // - the closing parenthesis, ex: ")" from "var(--color)"
      const variable = parts[i].split(/[,)\s+]/).shift();
      if (variable) {
        // Add back the double-dash. The initial string was split by "var(--"
        variables.push(`--${variable}`);
      }
    }
  }

  return variables;
}

function resolveKnownVars(foundVariables) {
  for (const variable in foundVariables) {
    const varData = foundVariables[variable];
    if (!varData.resolvedValues) {
      varData.resolvedValues = [];
    }

    function resolver(val, varData) {
      const parsedVars = getCSSVariables(val);

      for (const parsedVar of parsedVars) {
        /*
        if (containsDesignTokenValue(parsedVar)) {
          // Write this back to the top level.
          foundVariables[variable].containsDesignToken = true;
          continue;
        }
        if (containsExcludedValue(parsedVar)) {
          // Write this back to the top level.
          foundVariables[variable].containsExcludedValue = true;
        }*/
        const foundRef = foundVariables[parsedVar];
        if (foundRef) {
          varData.resolvedValues.push([parsedVar, foundRef]);
          if (foundRef.value.includes('--')) {
            resolver(foundRef.value, varData);
          }
        } else {
          varData.resolvedValues.push([parsedVar, 'MISSING']);
        }
      }
    }

    resolver(varData.value, varData);
  }
  // console.log(JSON.stringify(foundVariables, null, 4));
  return foundVariables;
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
      for (const externalFilePath of config.externalVarMapping[
        filePathPattern
      ]) {
        const extFilePath = path.resolve(
          path.join(config.repoPath, externalFilePath),
        );
        // Don't extract vars if we're looking at the same file.
        if (filePath === extFilePath) {
          console.log(`Skipping var extraction from ${externalFilePath}`);
          continue;
        }
        const extVars = await getExternalVars(extFilePath);
        // TODO: note that this will override keys so the last found wins.
        // We are logging this for local vars.
        foundVariables = { ...foundVariables, ...extVars };
      }
    }
  }

  let designTokenCount = 0;
  try {
    const root = await parseCSS(filePath);

    root.walk((node) => {
      const containsDesignToken = containsDesignTokenValue(node.value);
      const containsExcluded = containsExcludedValue(node.value);

      if (isTokenizableProperty(node.prop)) {
        foundPropValues.push({
          property: node.prop,
          value: node.value,
          containsDesignToken,
          containsExcludedValue: containsExcluded,
          isIndirectRef: false,
          start: node.source.start,
          end: node.source.end,
        });
      } else if (
        isVariableDefinition(node.prop) &&
        isWithinValidParentSelector(node)
      ) {
        // Existing keys here will not be overidden!
        if (foundVariables[node.prop]) {
          console.log(
            `${path.relative(config.repoPath, filePath)}:${node.source.start.line} "${node.prop}" already exists, skipping...`,
          );
        }
        // Vars in the current file will be collected but not marked as external.
        if (!foundVariables[node.prop]) {
          foundVariables[node.prop] = getVarData(node, { isExternal: false });
        }
      }
    });

    // Now that we have collected all vars we should look to recursively resolve them we we can.
    // TODO: Consider collecting what can't be resolved.
    foundVariables = resolveKnownVars(foundVariables);

    for (const decl of foundPropValues) {
      for (const variable in foundVariables) {
        if (decl.value.includes(`var(${variable})`)) {
          const foundVar = foundVariables[variable];
          decl.containsDesignToken = foundVar.containsDesignToken;
          decl.containsExcludedValue = foundVar.containsExcludedValue;
          decl.isExternalVar = foundVar.isExternal;
          decl.isIndirectRef = foundVar.isIndirectRef;
          decl.resolvedVarValue = foundVar.value;
          decl.resolvedValues = foundVar.resolvedValues;

          if (decl.isExternalVar) {
            decl.externalVarSrc = foundVar.src;
          }

          // Count resolved vars if we haven't already seen something
          // showing up as a design token/excluded value.
          for (const resolved of foundVar.resolvedValues) {
            const resolvedVar = resolved[1];

            if (resolvedVar?.containsDesignToken) {
              decl.containsDesignToken = true;
            }
            if (resolvedVar?.containsExcludedValue) {
              decl.containsExcludedValue = true;
            }
          }

          break;
        }
      }

      if (decl.containsDesignToken || decl.containsExcludedValue) {
        designTokenCount++;
      }
    }
  } catch (e) {
    console.error(`Unable to read or parse ${filePath}`);
    throw new Error(e);
  }

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
