import fs from 'node:fs/promises';

/*
 * Async function to return CSS content, annotated with HTML markup for display.
 *
 * @param {string} filePath. The path to a file to load that should be copied and annotated for display.
 * @param {Array} foundPropValues. The list of objects that contain CSS properties that should be found and annotated.
 * @returns {<Promise<string>} A string to be rendered.
 *
 */
export default async function (filePath, foundPropValues) {
  try {
    const content = await fs.readFile(filePath, 'utf8');

    /* Write markup around the relevant pieces by working through foundPropValues in reverse.
     * Each foundPropValue has markup like so:
     *
     * "start": {
     *   "offset": 756,
     *   "line": 37,
     *   "column": 3
     * },
     * "end": {
     *   "offset": 807,
     *   "line": 37,
     *   "column": 54
     * }
     *
     */

    const namespace = 'awdty';
    const openAnno = `<span class="${namespace}-found-prop-value">`;
    const closeAnno = '</span>';
    const openLineAnno = `<span class="${namespace}-line-{{modifier}}" title="{{title}}">`;
    const closeLineAnno = '</span>';

    function replaceModifier(entry, classnameString) {
      const { isDesignToken, isIndirectRef, isExcludedValue } = entry;
      let modifier = 'fail';
      let title = `This value doesn't directly use a design token`;
      if (isExcludedValue && isIndirectRef && !isDesignToken) {
        modifier = 'indirect-ignore-current';
        title =
          'This property refs a variable that resolves to an ignored value';
      } else if (isDesignToken && isIndirectRef) {
        modifier = 'indirect-token-current';
        title =
          'This property refs a variable that resolves to a design token in the current file';
      } else if (isDesignToken) {
        modifier = 'pass';
        title = 'This value is using a design token ❤️';
      } else if (!isDesignToken && isExcludedValue) {
        modifier = 'ignore';
        title = 'This value is ignored by our rules';
      }
      return classnameString
        .replace('{{modifier}}', modifier)
        .replace('{{title}}', title);
    }

    const lines = content.split('\n');
    for (const entry of foundPropValues) {
      // Single line
      if (entry.start.line === entry.end.line) {
        let line = lines[entry.start.line - 1];
        // Update the end of the line first to avoid breaking the column references.
        line = `${line.slice(0, entry.end.column - 1)}${closeAnno}${line.slice(entry.end.column - 1)}${closeLineAnno}`;
        line = `${replaceModifier(entry, openLineAnno)}${line.slice(0, entry.start.column - 1)}${openAnno}${line.slice(entry.start.column - 1)}`;
        lines[entry.start.line - 1] = line;
        // Multiline
      } else {
        let startLine = lines[entry.start.line - 1];
        lines[entry.start.line - 1] =
          `${replaceModifier(entry, openLineAnno)}${startLine.slice(0, entry.start.column - 1)}${openAnno}${startLine.slice(entry.start.column - 1)}`;

        let endLine = lines[entry.end.line - 1];
        lines[entry.end.line - 1] =
          `${endLine.slice(0, entry.end.column - 1)}${closeAnno}${endLine.slice(entry.end.column - 1)}${closeLineAnno}`;
      }
    }

    return lines.join('\n');
  } catch (e) {
    console.log(e);
    return 'Could not load file.';
  }
}
