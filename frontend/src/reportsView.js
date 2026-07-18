// Owner-facing Reports view: stock value, top movers (fastest-selling products), and
// recent price changes. Read-only, no confirmation flows here — just visibility.

async function renderReports(container, { days = 30 } = {}) {
  container.innerHTML = `<p class="muted">Loading reports...</p>`;

  let data;
  try {
    data = await window.api.apiRequest(`/reports/summary?days=${days}`);
  } catch (err) {
    container.innerHTML = `
      <h1 class="title">Reports</h1>
      <p class="error-text visible">${err.message}</p>
      <button type="button" class="btn-secondary" id="reports-back-btn">Back to Menu</button>
    `;
    document.getElementById('reports-back-btn').addEventListener('click', () => {
      if (window.renderHomeScreen) window.renderHomeScreen(container);
    });
    return;
  }

  const { stockValue, topMovers, priceChanges } = data;

  const categoryRows = stockValue.byCategory
    .map((c) => `
      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee;">
        <span>${escapeHtmlLocal(c.category)}</span>
        <span style="font-variant-numeric: tabular-nums;">₹${c.value.toFixed(2)}</span>
      </div>
    `)
    .join('');

  const topMoversRows = topMovers.length === 0
    ? '<p class="muted">No take-out activity in this period yet.</p>'
    : topMovers
        .map((m, i) => `
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
            <span>${i + 1}. ${escapeHtmlLocal(m.name)} <span class="muted">(${escapeHtmlLocal(m.category)})</span></span>
            <span style="font-weight: 600; font-variant-numeric: tabular-nums;">${m.totalTakenOut} ${escapeHtmlLocal(m.unit)}</span>
          </div>
        `)
        .join('');

  const priceChangeRows = priceChanges.length === 0
    ? '<p class="muted">No price changes recorded yet.</p>'
    : priceChanges
        .map((p) => {
          const dateStr = new Date(p.recordedAt).toLocaleDateString();
          let detail;
          if (p.changeType === 'first') {
            detail = `<span class="muted">First price seen: ₹${p.price}</span>`;
          } else if (p.changeType === 'increase') {
            detail = `<span style="color: var(--color-warning, #C77B23);">⚠️ ₹${p.previousPrice} → ₹${p.price}</span>`;
          } else if (p.changeType === 'decrease') {
            detail = `<span style="color: var(--color-success, #2E7D5B);">₹${p.previousPrice} → ₹${p.price}</span>`;
          } else {
            detail = `<span class="muted">₹${p.price} (unchanged)</span>`;
          }
          return `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
              <span>${escapeHtmlLocal(p.name)} <span class="muted">· ${dateStr}</span></span>
              ${detail}
            </div>
          `;
        })
        .join('');

  container.innerHTML = `
    <h1 class="title">Reports</h1>

    <h2 style="font-size: 16px; margin-top: 20px;">Total Stock Value</h2>
    <p style="font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums;">₹${stockValue.totalValue.toFixed(2)}</p>
    <div style="margin-top: 8px;">${categoryRows}</div>

    <h2 style="font-size: 16px; margin-top: 24px;">
      Top Movers
      <select id="days-select" style="font-size: 13px; margin-left: 8px;">
        <option value="7" ${days === 7 ? 'selected' : ''}>Last 7 days</option>
        <option value="30" ${days === 30 ? 'selected' : ''}>Last 30 days</option>
        <option value="90" ${days === 90 ? 'selected' : ''}>Last 90 days</option>
      </select>
    </h2>
    <div style="margin-top: 8px;">${topMoversRows}</div>

    <h2 style="font-size: 16px; margin-top: 24px;">Recent Price Changes</h2>
    <div style="margin-top: 8px;">${priceChangeRows}</div>

    <button type="button" class="btn-secondary" id="reports-back-btn" style="margin-top: 24px;">Back to Menu</button>
  `;

  document.getElementById('days-select').addEventListener('change', (e) => {
    renderReports(container, { days: Number(e.target.value) });
  });

  document.getElementById('reports-back-btn').addEventListener('click', () => {
    if (window.renderHomeScreen) window.renderHomeScreen(container);
  });
}

function escapeHtmlLocal(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

window.renderReports = renderReports;