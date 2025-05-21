import fs from 'node:fs/promises';
import path from 'path';
import config from '../../config.js';
import { minimatch } from 'minimatch';

import { parseCSS } from './cssParser.js';
import {
  isVariableDefinition,
  isTokenizableProperty,
  isWithinValidParentSelector,
} from './tokenUtils.js';

import { getExternalVars, getVarData } from './externalVars.js';
import {
  buildResolutionTrace,
  analyzeTrace,
  getResolutionSources,
  getUnresolvedVariablesFromTrace,
  classifyResolutionFromTrace,
  getResolvedVarOrigins,
} from './resolutionUtils.js';

import { UnresolvedVarTracker } from './trackUnresolvedVars.js';

/**
 * Analyzes a CSS file to determine the percentage of properties using design tokens.
 *
 * This includes:
 * - Extracting and resolving CSS custom properties
 * - Identifying token usage
 * - Tracking unresolved variables
 * - Calculating a token usage percentage
 *
 * @param {string} filePath - Absolute path to the CSS file.
 * @returns {Promise<{
 *   designTokenCount: number,
 *   foundProps: number,
 *   percentage: number,
 *   foundPropValues: object[],
 *   foundVariables: object
 * }>} - Summary object including token count, percentage, and annotated data.
 */
export async function getPropagationData(filePath) {
  try {
    const foundVariables = await collectExternalVars(filePath);
    const root = await parseCSS(filePath);

    const foundPropValues = collectDeclarations(root, foundVariables, filePath);
    await resolveDeclarationReferences(
      foundPropValues,
      foundVariables,
      filePath,
    );

    const { designTokenCount, ignoredValueCount } =
      computeDesignTokenSummary(foundPropValues);

    const foundLessIgnored = foundPropValues.length - ignoredValueCount;
    const percentage =
      foundPropValues.length && foundLessIgnored !== 0
        ? +((100 / foundLessIgnored) * designTokenCount).toFixed(2)
        : -1;

    return {
      designTokenCount,
      foundProps: foundPropValues.length,
      percentage,
      foundPropValues,
      foundVariables,
    };
  } catch (err) {
    console.error(`Unable to read or parse ${filePath} ${err.message}`);
    throw new Error(err);
  }
}

/**
 * Collects external variables for a given file based on pattern matching from config.
 *
 * Skips external files that are the same as the input file.
 *
 * @param {string} filePath - The file path to match against config.externalVarMapping.
 * @returns {Promise<object>} - Map of variable names to external variable metadata.
 */
async function collectExternalVars(filePath) {
  let foundVariables = {};

  for (const pattern in config.externalVarMapping) {
    if (minimatch(filePath, `**/${pattern}`)) {
      for (const externalRelPath of config.externalVarMapping[pattern]) {
        const externalAbsPath = path.resolve(
          path.join(config.repoPath, externalRelPath),
        );

        if (externalAbsPath === filePath) {
          console.log(`Skipping var extraction from ${externalRelPath}`);
          continue;
        }

        let extVars = {};
        try {
          await fs.access(externalAbsPath, fs.constants.R_OK);
          extVars = await getExternalVars(externalAbsPath);
        } catch (e) {
          console.log(
            `${externalRelPath} doesn't exist, skipping... ${e.message}`,
          );
        }

        foundVariables = { ...foundVariables, ...extVars };
      }
    }
  }

  return foundVariables;
}

/**
 * Walks the CSS AST and collects:
 * - Tokenizable properties (e.g. `color`, `font-size`)
 * - Variable definitions (`--*`) that are not external
 *
 * Adds new local variables to `foundVariables`.
 *
 * @param {import('postcss').Root} root - Parsed CSS AST.
 * @param {object} foundVariables - Accumulator object for collected variables.
 * @param {string} filePath - Path to the file being analyzed.
 * @returns {object[]} - Array of property declaration objects.
 */
function collectDeclarations(root, foundVariables, filePath) {
  const declarations = [];

  root.walk((node) => {
    if (!node.prop || !node.value) {
      return;
    }

    if (isTokenizableProperty(node.prop)) {
      declarations.push({
        property: node.prop,
        value: node.value,
        start: node.source.start,
        end: node.source.end,
      });
    } else if (
      isVariableDefinition(node.prop) &&
      isWithinValidParentSelector(node)
    ) {
      if (foundVariables[node.prop]) {
        console.log(
          `${path.relative(config.repoPath, filePath)}:${node.source.start.line} "${node.prop}" already exists, skipping...`,
        );
      } else {
        foundVariables[node.prop] = getVarData(node, { isExternal: false });
      }
    }
  });

  return declarations;
}

const tracker = new UnresolvedVarTracker();

/**
 * Resolves variable references for each declaration, attaches trace data,
 * and annotates with token usage, source origins, and unresolved variable info.
 *
 * Writes an unresolved variable report to `src/data/unresolvedVars.json`.
 *
 * @param {object[]} declarations - Declarations to resolve and annotate.
 * @param {object} foundVariables - Known variables available for resolution.
 * @param {string} filePath - Path of the file being analyzed.
 * @returns {Promise<void>}
 */
async function resolveDeclarationReferences(
  declarations,
  foundVariables,
  filePath,
) {
  for (const decl of declarations) {
    const trace = buildResolutionTrace(decl.value, foundVariables);
    const analysis = analyzeTrace(trace);

    decl.resolutionTrace = trace;
    decl.containsDesignToken = analysis.containsDesignToken;
    decl.containsExcludedValue = analysis.containsExcludedValue;

    decl.isExternalVar = trace.some((val) =>
      Object.values(foundVariables).some(
        (ref) => ref.isExternal && ref.value === val,
      ),
    );

    decl.resolutionSources = getResolutionSources(
      trace,
      foundVariables,
      filePath,
    );

    decl.unresolvedVariables = getUnresolvedVariablesFromTrace(
      trace,
      foundVariables,
    );

    tracker.addFromDeclaration(decl, filePath);

    decl.resolutionType = classifyResolutionFromTrace(
      trace,
      foundVariables,
      filePath,
    );

    decl.resolvedFrom = getResolvedVarOrigins(trace, foundVariables, filePath);
  }

  const unresolvedReport = tracker.toReport();
  await fs.writeFile(
    path.join('./src/data', 'unresolvedVars.json'),
    JSON.stringify(unresolvedReport, null, 2),
  );
}

/**
 * Computes summary statistics from the resolved declarations:
 * - Number of declarations using design tokens
 * - Number of ignored values (excluded tokens without design tokens)
 *
 * @param {object[]} declarations - List of annotated declarations.
 * @returns {{ designTokenCount: number, ignoredValueCount: number }}
 */
function computeDesignTokenSummary(declarations) {
  return {
    designTokenCount: declarations.filter((d) => d.containsDesignToken).length,
    ignoredValueCount: declarations.filter(
      (d) => d.containsExcludedValue && !d.containsDesignToken,
    ).length,
  };
}
