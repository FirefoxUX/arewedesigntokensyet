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
 * Main entry point: analyze a single CSS file for design token propagation.
 *
 * @param {string} filePath - Absolute path to the CSS file.
 * @returns {Promise<Object>} - Object containing analysis results.
 */
export async function getPropagationData(filePath) {
  try {
    const foundVariables = await collectExternalVars(filePath);
    const root = await parseCSS(filePath);

    const foundPropValues = collectDeclarations(root, foundVariables, filePath);
    resolveDeclarationReferences(foundPropValues, foundVariables, filePath);

    const designTokenCount = computeDesignTokenSummary(foundPropValues);
    const percentage = foundPropValues.length
      ? +((100 * designTokenCount) / foundPropValues.length).toFixed(2)
      : 100;

    return {
      designTokenCount,
      foundProps: foundPropValues.length,
      percentage,
      foundPropValues,
      foundVariables,
    };
  } catch (err) {
    console.error(`Unable to read or parse ${filePath}`);
    throw new Error(err);
  }
}

/**
 * Collects external variables based on file path mapping in config.
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

        const extVars = await getExternalVars(externalAbsPath);
        foundVariables = { ...foundVariables, ...extVars };
      }
    }
  }

  return foundVariables;
}

/**
 * Walks CSS AST to extract tokenizable properties and local variable definitions.
 */
function collectDeclarations(root, foundVariables, filePath) {
  const declarations = [];

  root.walk((node) => {
    if (!node.prop || !node.value) return;

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

/**
 * Applies resolution trace to each declaration and annotates with token usage info.
 */
const tracker = new UnresolvedVarTracker();

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
    decl.isIndirectRef = trace.length > 1;

    // Heuristically infer if any resolved value is from an external var
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
 * Computes how many declarations use design tokens or excluded values.
 */
function computeDesignTokenSummary(declarations) {
  return declarations.filter(
    (d) => d.containsDesignToken || d.containsExcludedValue,
  ).length;
}
