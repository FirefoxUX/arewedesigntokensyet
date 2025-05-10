import fs from 'node:fs/promises';
import path from 'path';

import config from '../../config.js';

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
      ignore: {
        modifier: 'ignore',
        title: 'This value is ignored by our rules 👌',
      },
      'indirect-ignore': {
        modifier: 'indirect-ignore-current',
        title:
          'This property value resolves to an ignored value 👌\n{{ value }}',
      },
      'indirect-ignore-external': {
        modifier: 'indirect-ignore-external',
        title:
          'This property value resolves to an ignored value in an external file 👌\n{{ value }}\n{{ file }}',
      },
      pass: {
        modifier: 'pass',
        title: 'This value is using a design token ❤️',
      },
      'indirect-pass': {
        modifier: 'indirect-pass-current',
        title:
          'This property value resolves to a design token in the current file ❤️\n {{ value }}',
      },
      'indirect-pass-external': {
        modifier: 'indirect-pass-external',
        title:
          'This property value resolves to a design token in an external file ❤️\n{{ value }}\n{{ file }}',
      },
      fail: {
        modifier: 'fail',
        title: `This value doesn't directly use a design token 😔`,
      },
      'indirect-fail': {
        modifier: 'indirect-fail-current',
        title:
          'This property value does not resolve to a design token 😔\n{{ value }}',
      },
      'indirect-fail-external': {
        modifier: 'indirect-fail-external',
        title:
          'This property value does not resolve to a design token 😔\n{{ value }}\n{{ file }}',
      },
    };

    const decorations = [];
    for (const entry of foundPropValues) {
      const { isDesignToken, isIndirectRef, isExcludedValue, isExternalVar } =
        entry;
      let decorationData = strings.fail;
      if (
        !isExcludedValue &&
        isIndirectRef &&
        !isDesignToken &&
        !isExternalVar
      ) {
        decorationData = strings['indirect-fail'];
      } else if (
        !isExcludedValue &&
        isIndirectRef &&
        !isDesignToken &&
        isExternalVar
      ) {
        decorationData = strings['indirect-fail-external'];
      } else if (
        isExcludedValue &&
        isIndirectRef &&
        !isDesignToken &&
        isExternalVar
      ) {
        decorationData = strings['indirect-ignore-external'];
      } else if (isExcludedValue && isIndirectRef && !isDesignToken) {
        decorationData = strings['indirect-ignore'];
      } else if (isDesignToken && isIndirectRef && isExternalVar) {
        decorationData = strings['indirect-pass-external'];
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
          title: decorationData.title
            .replace(
              '{{ value }}',
              entry.externalVarValue ? `value: ${entry.externalVarValue}` : '',
            )
            .replace(
              '{{ file }}',
              entry.externalVarSrc
                ? `src: ${path.relative(config.repoPath, entry.externalVarSrc)}`
                : '',
            ),
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
