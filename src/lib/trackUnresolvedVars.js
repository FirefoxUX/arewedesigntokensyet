import path from 'path';
import config from '../../config.js';

/**
 * Tracks unresolved CSS custom properties (variables) across files,
 * excluding known design tokens.
 *
 * Used to generate reports of undefined variables that may need to be fixed or reviewed.
 */
export class UnresolvedVarTracker {
  constructor() {
    this._vars = {};
  }

  /**
   * Adds unresolved variables from a declaration to the tracker.
   *
   * Ignores variables that match known design token keys.
   *
   * @param {object} decl - The resolved declaration object.
   * @param {string} filePath - Absolute path of the CSS file where the declaration occurs.
   */
  addFromDeclaration(decl, filePath) {
    if (!decl.unresolvedVariables?.length) {
      return;
    }

    for (const varName of decl.unresolvedVariables) {
      if (this._isDesignToken(varName)) {
        continue;
      }

      if (!this._vars[varName]) {
        this._vars[varName] = new Set();
      }

      this._vars[varName].add(filePath);
    }
  }

  /**
   * Determines whether the variable name is considered a known design token.
   *
   * @param {string} name - The variable name to check.
   * @returns {boolean} - True if it matches a configured design token key.
   * @private
   */
  _isDesignToken(name) {
    return config.designTokenKeys.some((token) => name.includes(token));
  }

  /**
   * Returns a sorted report of unresolved variables, grouped by name and file count.
   *
   * @returns {Array<{ variable: string, count: number, files: string[] }>} -
   *   An array of unresolved variable entries sorted by usage count (descending).
   */
  toReport() {
    return Object.entries(this._vars)
      .map(([variable, fileSet]) => ({
        variable,
        count: fileSet.size,
        files: [...fileSet].map((f) => path.relative(config.repoPath, f)),
      }))
      .sort((a, b) => b.count - a.count);
  }
}
