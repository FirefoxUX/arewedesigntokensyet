import fs from 'node:fs/promises';
import config from '../../config.js';
import { codeToHtml } from 'shiki';

function isDesignToken(name) {
  return config.designTokenKeys.some((token) => name.includes(token));
}

function dedupeTrace(trace = []) {
  const result = [];
  for (let i = 0; i < trace.length; i++) {
    if (i === 0 || trace[i] !== trace[i - 1]) {
      result.push(trace[i]);
    }
  }
  return result;
}

function getStatus(prop) {
  return prop.containsDesignToken
    ? 'good'
    : prop.containsExcludedValue
      ? 'warn'
      : 'bad';
}

function extractTooltipData(prop) {
  const status = getStatus(prop);
  const trace = dedupeTrace(prop.resolutionTrace || []);

  const unresolved = (prop.unresolvedVariables || []).filter(
    (v) => !isDesignToken(v),
  );

  const tokensUsed = new Set();
  for (const step of trace) {
    const matches = step.match(/--[\w-]+/g) || [];
    for (const token of matches) {
      if (isDesignToken(token)) {
        tokensUsed.add(token);
      }
    }
  }

  return {
    status,
    trace,
    tokens: [...tokensUsed],
    source: !prop.containsExcludedValue ? prop.resolutionSources || [] : [],
    unresolved,
  };
}

export default async function loadAndAnnotateFile(filePath, foundPropValues) {
  const content = await fs.readFile(filePath, 'utf8');
  const decorations = [];

  for (const prop of foundPropValues) {
    const { start, end, resolutionType } = prop;

    const tooltipData = extractTooltipData(prop);

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
        'data-status': tooltipData.status,
        'data-trace': JSON.stringify(tooltipData.trace),
        'data-tokens': JSON.stringify(tooltipData.tokens),
        'data-source': JSON.stringify(tooltipData.source),
        'data-unresolved': JSON.stringify(tooltipData.unresolved),
        tabindex: '0',
        role: 'button',
        'aria-describedby': 'token-tooltip',
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
