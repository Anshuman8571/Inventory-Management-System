// Renders the Inventory Dashboard to view all products, their current quantities,
// last known purchase price, and (via the History button) each product's full
// movement + price timeline.

async function renderDashboard(container) {
  container.innerHTML = `
    ${window.homeButtonHtml ? window.homeButtonHtml() : ''}
    <h1 class="title">Inventory Dashboard</h1>
    <p class="muted">Loading inventory...</p>
  `;
  if (window.attachHomeButton) window.attachHomeButton(container);

  try {
    const { products } = await window.api.apiRequest('/products');

    if (products.length === 0) {
      container.innerHTML = `
        ${window.homeButtonHtml ? window.homeButtonHtml() : ''}
        <h1 class="title">Inventory Dashboard</h1>
        <p class="muted">No products found in inventory.</p>
      `;
      if (window.attachHomeButton) window.attachHomeButton(container);
      return;
    }

    let tableHtml = `
      <table class="inventory-table" style="width: 100%; text-align: left; margin-top: 20px; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 2px solid #ccc;">
            <th style="padding: 10px;">Product Name</th>
            <th style="padding: 10px;">Category</th>
            <th style="padding: 10px;">Size</th>
            <th style="padding: 10px;">Type</th>
            <th style="padding: 10px;">Company</th>
            <th style="padding: 10px; text-align: right;">Last Price</th>
            <th style="padding: 10px; text-align: right;">Current Qty</th>
            <th style="padding: 10px;"></th>
          </tr>
        </thead>
        <tbody>
    `;

    products.forEach(p => {
      const isLowStock = p.low_stock_at && p.current_qty <= p.low_stock_at;
      const rowStyle = isLowStock ? 'background-color: #fdf5e6;' : '';
      const priceDisplay = p.last_known_price != null ? `₹${p.last_known_price}` : '-';

      tableHtml += `
        <tr style="border-bottom: 1px solid #eee; ${rowStyle}">
          <td style="padding: 10px; font-weight: bold;">${p.name}</td>
          <td style="padding: 10px;">${p.category}</td>
          <td style="padding: 10px;">${p.attributes?.size || '-'}</td>
          <td style="padding: 10px;">${p.attributes?.type || '-'}</td>
          <td style="padding: 10px;">${p.company || '-'}</td>
          <td style="padding: 10px; text-align: right; font-variant-numeric: tabular-nums;">${priceDisplay}</td>
          <td style="padding: 10px; text-align: right; font-weight: bold; font-variant-numeric: tabular-nums;">
            ${p.current_qty} ${p.unit}
            ${isLowStock ? ' ⚠️' : ''}
          </td>
          <td style="padding: 10px;">
            <button type="button" class="btn-secondary history-btn" data-id="${p.id}" data-name="${escapeHtmlLocal(p.name)}" style="padding: 6px 10px; font-size: 13px; height: auto;">History</button>
          </td>
        </tr>
      `;
    });

    tableHtml += `
        </tbody>
      </table>
    `;

    container.innerHTML = `
      ${window.homeButtonHtml ? window.homeButtonHtml() : ''}
      <h1 class="title">Inventory Dashboard</h1>
      <div style="overflow-x: auto;">
        ${tableHtml}
      </div>
    `;
    if (window.attachHomeButton) window.attachHomeButton(container);

    container.querySelectorAll('.history-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        renderProductHistory(container, Number(btn.dataset.id), btn.dataset.name);
      });
    });

  } catch (err) {
    container.innerHTML = `
      ${window.homeButtonHtml ? window.homeButtonHtml() : ''}
      <h1 class="title">Inventory Dashboard</h1>
      <p class="error-text visible">Failed to load inventory: ${err.message}</p>
    `;
    if (window.attachHomeButton) window.attachHomeButton(container);
  }
}

// One product's full timeline: every quantity change and every price it's been
// bought at, merged into a single chronological list so the owner can see the
// whole story of a product at a glance rather than two disconnected tables.
async function renderProductHistory(container, productId, productName) {
  container.innerHTML = `
    ${window.homeButtonHtml ? window.homeButtonHtml() : ''}
    <p class="muted">Loading history for ${escapeHtmlLocal(productName)}...</p>
  `;
  if (window.attachHomeButton) window.attachHomeButton(container);

  let data;
  try {
    data = await window.api.apiRequest(`/products/${productId}/history`);
  } catch (err) {
    container.innerHTML = `
      ${window.homeButtonHtml ? window.homeButtonHtml() : ''}
      <p class="error-text visible">${err.message}</p>
      <button type="button" class="btn-secondary" id="history-back-btn">Back to Dashboard</button>
    `;
    if (window.attachHomeButton) window.attachHomeButton(container);
    document.getElementById('history-back-btn').addEventListener('click', () => renderDashboard(container));
    return;
  }

  const { product, movements, priceHistory } = data;

  const events = [
    ...movements.map((m) => ({
      type: 'movement',
      date: m.created_at,
      changeQty: m.change_qty,
    })),
    ...priceHistory.map((ph) => ({
      type: 'price',
      date: ph.recorded_at,
      price: ph.price,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const rowsHtml = events.length === 0
    ? '<p class="muted">No history yet for this product.</p>'
    : events.map((e) => {
        const dateStr = new Date(e.date).toLocaleString();
        if (e.type === 'movement') {
          const isIncrease = e.changeQty > 0;
          const sign = isIncrease ? '+' : '';
          const color = isIncrease ? 'var(--color-success, #2E7D5B)' : 'var(--color-error, #B33A3A)';
          return `
            <div style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;">
              <span>${dateStr}</span>
              <span style="color: ${color}; font-weight: 600; font-variant-numeric: tabular-nums;">
                ${sign}${e.changeQty} ${product.unit}
              </span>
            </div>
          `;
        }
        return `
          <div style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;">
            <span>${dateStr}</span>
            <span style="font-variant-numeric: tabular-nums;">Price recorded: ₹${e.price}</span>
          </div>
        `;
      }).join('');

  container.innerHTML = `
    ${window.homeButtonHtml ? window.homeButtonHtml() : ''}
    <h1 class="title">${escapeHtmlLocal(product.name)}</h1>
    <p class="muted">Current stock: ${product.current_qty} ${product.unit} · Last price: ${product.last_known_price != null ? `₹${product.last_known_price}` : '-'}</p>
    <div style="margin-top: 16px; border-top: 2px solid #ccc;">
      ${rowsHtml}
    </div>
    <button type="button" class="btn-secondary" id="history-back-btn" style="margin-top: 20px;">Back to Dashboard</button>
  `;
  if (window.attachHomeButton) window.attachHomeButton(container);
  document.getElementById('history-back-btn').addEventListener('click', () => renderDashboard(container));
}

function escapeHtmlLocal(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

window.renderDashboard = renderDashboard;
window.renderProductHistory = renderProductHistory;