import fs from 'node:fs/promises';

import { codeToHtml } from 'shiki';

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
    const namespace = 'awdty';

    const strings = {
      'indirect-ignore': {
        modifier: 'indirect-ignore-current',
        title:
          'This property refs a variable that resolves to an ignored value',
      },
      'indirect-pass': {
        modifier: 'indirect-token-current',
        title:
          'This property refs a variable that resolves to a design token in the current file',
      },
      pass: {
        modifier: 'pass',
        title: 'This value is using a design token ❤️',
      },
      fail: {
        modifier: 'fail',
        title: `This value doesn't directly use a design token`,
      },
      ignore: {
        modifier: 'ignore',
        title: 'This value is ignored by our rules',
      },
    };

    const decorations = [];
    for (const entry of foundPropValues) {
      const { isDesignToken, isIndirectRef, isExcludedValue } = entry;
      let decorationData = strings.fail;
      if (isExcludedValue && isIndirectRef && !isDesignToken) {
        decorationData = strings['indirect-ignore'];
      } else if (isDesignToken && isIndirectRef) {
        decorationData = strings['indirect-pass'];
      } else if (isDesignToken) {
        decorationData = strings.pass;
      } else if (!isDesignToken && isExcludedValue) {
        decorationData = strings.ignore;
      }

      decorations.push({
        start: {
          line: entry.start.line - 1,
          character: entry.start.column - 1,
        },
        end: { line: entry.end.line - 1, character: entry.end.column - 1 },
        properties: {
          class: `${namespace}-line-${decorationData.modifier}`,
          title: decorationData.title,
        },
      });
    }

    const html = await codeToHtml(content, {
      theme: 'slack-ochin',
      lang: 'css',
      decorations,
    });

    return html;
  } catch (e) {
    console.log(e);
    return 'Could not load file.';
  }
}
