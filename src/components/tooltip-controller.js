/* globals window, document, requestAnimationFrame */

function safeParseJSON(value, fallback = []) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

const tooltip = document.createElement('token-tooltip');
tooltip.hidden = true;
document.body.appendChild(tooltip);

function showTooltip(triggerEl) {
  const rect = triggerEl.getBoundingClientRect();
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  const scrollX = window.scrollX || document.documentElement.scrollLeft;

  tooltip.status = triggerEl.dataset.status || '';
  tooltip.trace = safeParseJSON(triggerEl.dataset.trace);
  tooltip.source = safeParseJSON(triggerEl.dataset.source);
  tooltip.unresolved = safeParseJSON(triggerEl.dataset.unresolved);
  tooltip.tokens = safeParseJSON(triggerEl.dataset.tokens);
  tooltip.style.top = `${rect.bottom + scrollY + 6}px`;
  tooltip.style.left = `${rect.left + scrollX}px`;
  tooltip.hidden = false;
  tooltip.pinned = false;

  requestAnimationFrame(() => {
    const tipRect = tooltip.getBoundingClientRect();
    const overflowRight = tipRect.right > window.innerWidth;
    tooltip.classList.toggle('wrap', overflowRight);
  });
}

function hideTooltip() {
  if (!tooltip.pinned) {
    tooltip.hidden = true;
  }
}

document.addEventListener('mouseover', (e) => {
  const el = e.target.closest('[data-status]');
  if (el) {
    showTooltip(el);
  } else {
    hideTooltip();
  }
});

document.addEventListener('focusin', (e) => {
  const el = e.target.closest('[data-status]');
  if (el) {
    showTooltip(el);
  }
});

document.addEventListener('focusout', hideTooltip);
document.addEventListener('scroll', hideTooltip, true);

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-status]')) {
    e.preventDefault();
    tooltip.pinned = !tooltip.pinned;
  } else {
    tooltip.pinned = false;
    tooltip.hidden = true;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    tooltip.pinned = false;
    tooltip.hidden = true;
  }
});
