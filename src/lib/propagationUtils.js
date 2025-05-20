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
 * Analyze a single CSS file for design token propagation.
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

    const { designTokenCount, ignoredValueCount } =
      computeDesignTokenSummary(foundPropValues);

    // A negative number means this percentage should be ignored. If there are no found props then we can't provide a score.
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
 * Walks CSS AST to extract tokenizable properties and local variable definitions.
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
  return {
    designTokenCount: declarations.filter((d) => d.containsDesignToken).length,
    ignoredValueCount: declarations.filter(
      (d) => d.containsExcludedValue && !d.containsDesignToken,
    ).length,
  };
}
