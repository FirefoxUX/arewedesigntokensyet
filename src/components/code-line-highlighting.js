/* globals window, document, requestAnimationFrame, history */

function parseLineHash() {
  const hash = window.location.hash;
  if (!hash.startsWith('#L')) {
    return [];
  }

  const [start, end] = hash.slice(2).split('-').map(Number);
  if (Number.isNaN(start)) {
    return [];
  }
  return Array.from(
    { length: (end || start) - start + 1 },
    (_, i) => start + i,
  );
}

function highlightLines(lines) {
  document
    .querySelectorAll('.line')
    .forEach((el) => el.classList.remove('highlighted-line'));
  lines.forEach((n) => {
    const el = document.getElementById(`L${n}`);
    if (el) {
      el.classList.add('highlighted-line');
    }
  });
}

function injectLineNumbers() {
  document.querySelectorAll('pre.shiki .line').forEach((lineEl, i) => {
    const lineNumber = i + 1;
    const numberEl = document.createElement('span');
    numberEl.className = 'line-number-trigger';
    numberEl.dataset.line = lineNumber;
    numberEl.textContent = lineNumber;
    lineEl.dataset.line = lineNumber;
    lineEl.id = `L${lineNumber}`;
    lineEl.prepend(numberEl);
  });
}

let lastClicked = null;
let userClickedLine = false;

document.addEventListener('click', (e) => {
  const el = e.target.closest('.line-number-trigger');
  if (!el) {
    return;
  }

  const line = Number(el.dataset.line);
  if (Number.isNaN(line)) {
    return;
  }

  userClickedLine = true;

  if (e.shiftKey && lastClicked) {
    const [from, to] = [lastClicked, line].sort((a, b) => a - b);
    history.pushState(null, '', `#L${from}-${to}`);
    highlightLines(parseLineHash());
  } else {
    history.pushState(null, '', `#L${line}`);
    highlightLines([line]);
    lastClicked = line;
  }

  e.preventDefault();
});

function handleHashChange() {
  const lines = parseLineHash();
  highlightLines(lines);

  if (!userClickedLine && lines.length) {
    const el = document.getElementById(`L${lines[0]}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  userClickedLine = false;
}

window.addEventListener('hashchange', handleHashChange);
window.addEventListener('load', () =>
  requestAnimationFrame(() => {
    injectLineNumbers();
    handleHashChange();
  }),
);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    history.pushState(null, '', window.location.pathname);
    highlightLines([]);
  }
});
