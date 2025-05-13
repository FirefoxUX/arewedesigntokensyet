import path from 'path';
import config from '../../config.js';

/**
 * Tracks unresolved variables by file, excluding known design tokens.
 */
export class UnresolvedVarTracker {
  constructor() {
    this._vars = {}; // varName → Set of filePaths
  }

  addFromDeclaration(decl, filePath) {
    if (!decl.unresolvedVariables?.length) return;

    for (const varName of decl.unresolvedVariables) {
      if (this._isDesignToken(varName)) continue;

      if (!this._vars[varName]) {
        this._vars[varName] = new Set();
      }

      this._vars[varName].add(filePath);
    }
  }

  _isDesignToken(name) {
    return config.designTokenKeys.some((token) => name.includes(token));
  }

  /**
   * Returns a sorted array of unresolved vars by frequency.
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
