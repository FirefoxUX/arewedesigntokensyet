import fs from 'node:fs/promises';

import config from '../../config.js';
import { codeToHtml } from 'shiki';

function isDesignToken(name) {
  return config.designTokenKeys.some((token) => name.includes(token));
}

function buildHoverMessage(prop) {
  const messages = [];

  // Base classification
  if (prop.containsDesignToken) {
    messages.push(`🏆 This value is using Design Tokens!`);
  } else if (prop.containsExcludedValue) {
    messages.push(`🆗 This value is ignored.`);
  } else if (prop.resolutionType === 'direct') {
    messages.push(
      `❌ Direct value should use a design token\nValue: ${prop.value}`,
    );
  } else {
    messages.push(`❌ Indirect value not using a design token`);
  }

  // Trace
  const cleanTrace = (prop.resolutionTrace || []).filter(
    (v) => v !== 'MISSING',
  );
  if (cleanTrace.length > 1) {
    messages.push(`🔁 Trace:\n  ${cleanTrace.join('\n  → ')}`);
  }

  // Design token display (explicit)
  if (prop.containsDesignToken) {
    const tokenVars = new Set();
    for (const step of prop.resolutionTrace || []) {
      const matches = step.match(/--[\w-]+/g) || [];
      for (const m of matches) {
        if (isDesignToken(m)) tokenVars.add(m);
      }
    }

    if (tokenVars.size) {
      messages.push(`🎨 Tokens Used:\n  ${[...tokenVars].join('\n  ')}`);
    }
  }

  // External sources
  if (prop.resolutionSources?.length && prop.resolutionType !== 'direct') {
    messages.push(`📁 From:\n  ${prop.resolutionSources.join('\n  ')}`);
  }

  // Only non-token unresolved vars
  const unresolved = (prop.unresolvedVariables || []).filter(
    (v) => !isDesignToken(v),
  );
  if (unresolved.length) {
    messages.push(`⚠️ Unresolved:\n  ${unresolved.join('\n  ')}`);
  }

  return messages.join('\n\n');
}

/**
 * Loads and annotates a CSS file with inline highlights for token usage.
 *
 * @param {string} filePath - Absolute path to the CSS file.
 * @param {Array} foundPropValues - List of analyzed declarations.
 * @returns {Promise<string>} - Annotated syntax-highlighted HTML.
 */
export default async function loadAndAnnotateFile(filePath, foundPropValues) {
  const content = await fs.readFile(filePath, 'utf8');

  const decorations = [];

  for (const prop of foundPropValues) {
    const { start, end, resolutionType } = prop;
    if (!start || !end) continue;

    const status = prop.containsDesignToken
      ? 'good'
      : prop.containsExcludedValue
        ? 'warn'
        : 'bad';

    decorations.push({
      start: {
        line: start.line - 1,
        character: start.column - 1,
      },
      end: {
        line: end.line - 1,
        character: end.column - 1,
      },
      properties: {
        class: `awdty--${resolutionType}`,
        title: buildHoverMessage(prop),
        'data-status': status,
      },
    });
  }

  const html = await codeToHtml(content, {
    lang: 'css',
    theme: 'slack-ochin',
    decorations,
  });

  return html;
}
