const codesRoot = document.querySelector('#codes');
const pastStatuses = ['USED', 'REVOKED', 'EXPIRED'];
let arranging = false;

function statusOf(row) {
  const text = row.querySelector('small')?.textContent || '';
  return pastStatuses.find((status) => text.includes(`· ${status} ·`)) || '';
}

function compactAccessCodes() {
  if (!codesRoot || arranging) return;

  const rows = [
    ...codesRoot.querySelectorAll(':scope > .row'),
    ...codesRoot.querySelectorAll(':scope > details.code-history .row')
  ];
  if (!rows.length) return;

  const current = [];
  const past = [];
  for (const row of rows) {
    if (statusOf(row)) past.push(row);
    else current.push(row);
  }

  const signature = rows.map((row) => `${row.querySelector('[data-id]')?.dataset.id || ''}:${statusOf(row) || 'CURRENT'}`).join('|');
  const alreadyCompacted = codesRoot.dataset.compactSignature === signature && (past.length === 0 || codesRoot.querySelector(':scope > details.code-history'));
  if (alreadyCompacted) return;

  arranging = true;
  codesRoot.replaceChildren(...current);

  if (past.length) {
    const details = document.createElement('details');
    details.className = 'code-history';

    const summary = document.createElement('summary');
    summary.textContent = `Past codes (${past.length}) · USED / REVOKED / EXPIRED`;
    summary.style.cursor = 'pointer';
    summary.style.padding = '14px 0';
    summary.style.opacity = '.78';
    summary.style.fontWeight = '700';

    const list = document.createElement('div');
    list.className = 'admin-list';
    list.append(...past);

    details.append(summary, list);
    codesRoot.append(details);
  }

  if (!current.length && past.length) {
    const empty = document.createElement('p');
    empty.className = 'helper';
    empty.textContent = '현재 사용 가능한 Access Code가 없습니다.';
    codesRoot.prepend(empty);
  }

  codesRoot.dataset.compactSignature = signature;
  arranging = false;
}

if (codesRoot) {
  const observer = new MutationObserver(() => queueMicrotask(compactAccessCodes));
  observer.observe(codesRoot, { childList: true, subtree: true });
  compactAccessCodes();
}
