// Renders the Inventory Dashboard: search + quick category/low-stock filters, a
// product list with color-coded low-stock/out-of-stock badges and price-trend
// arrows, and (via the History button) each product's full movement + price
// timeline — the last piece of Phase 6.
//
// Note on "responsive": this whole app renders inside a fixed ~360px-wide card at
// every viewport size (see .card in styles.css) — there's no desktop layout to
// adapt down from. The old 8-column table only "worked" by scrolling sideways
// inside that 360px card, which is exactly the kind of scrolling this redesign
// removes: everything below is a single stacked column that fits without
// horizontal scroll, with the low-stock/critical status pulled out as a badge
// instead of a table cell you had to scroll to find.

async function renderDashboard(container) {
  container.innerHTML = `
    <h1 class="title">Inventory Dashboard</h1>
    <p class="muted">Loading inventory...</p>
  `;

  let products;
  try {
    const result = await window.api.apiRequest('/products');
    products = result.products || [];
  } catch (err) {
    container.innerHTML = `
      <h1 class="title">Inventory Dashboard</h1>
      <p class="error-text visible">Failed to load inventory: ${err.message}</p>
      <button type="button" class="btn-secondary" id="back-btn" style="margin-top: 20px;">Back</button>
    `;
    document.getElementById('back-btn').addEventListener('click', () => history.back());
    return;
  }

  renderDashboardBody(container, products);
}

function renderDashboardBody(container, products) {
  const state = { search: '', filter: 'all' };

  // Derived from the actual products, not hardcoded — a chip for a brand-new
  // category with zero products in it yet wouldn't do anything useful here.
  const categoriesPresent = [...new Set(products.map((p) => p.category))].sort();

  container.innerHTML = `
    <h1 class="title">Inventory Dashboard</h1>

    <input
      type="text"
      id="dash-search"
      class="dash-search"
      placeholder="Search by name or company..."
      ${products.length === 0 ? 'disabled' : ''}
    />

    <div class="quick-filter-row" id="dash-quick-filters">
      <button type="button" class="chip-filter active" data-filter="all">All</button>
      ${categoriesPresent
        .map((c) => `<button type="button" class="chip-filter" data-filter="${escapeHtmlLocal(c)}">${escapeHtmlLocal(c)}</button>`)
        .join('')}
      <button type="button" class="chip-filter" data-filter="low">⚠️ Low Stock</button>
    </div>

    <p class="muted" id="dash-result-count" style="margin: 10px 0 4px;"></p>

    <div id="dash-list-container"></div>
  `;

  const searchInput = document.getElementById('dash-search');
  const listContainer = document.getElementById('dash-list-container');
  const countEl = document.getElementById('dash-result-count');
  const filtersEl = document.getElementById('dash-quick-filters');

  function applyFilters() {
    const term = state.search.trim().toLowerCase();
    const filtered = products.filter((p) => {
      if (state.filter === 'low' && !isLowStock(p)) return false;
      if (state.filter !== 'all' && state.filter !== 'low' && p.category !== state.filter) return false;
      if (term) {
        const haystack = `${p.name} ${p.company || ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
    countEl.textContent =
      products.length === 0 ? '' : `${filtered.length} of ${products.length} products`;
    renderProductList(container, listContainer, filtered);
  }

  searchInput.addEventListener('input', (e) => {
    state.search = e.target.value;
    applyFilters();
  });

  filtersEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-filter');
    if (!btn) return;
    state.filter = btn.dataset.filter;
    filtersEl.querySelectorAll('.chip-filter').forEach((b) => b.classList.toggle('active', b === btn));
    applyFilters();
  });

  applyFilters();
}

function isLowStock(p) {
  return p.low_stock_at != null && p.current_qty <= p.low_stock_at;
}

// Only surfaces a badge when there's actually something to act on — avoids
// covering every in-stock row with a "success" badge nobody needs to read.
function stockStatus(p) {
  if (p.current_qty <= 0) return { label: 'Out of stock', cls: 'chip-critical' };
  if (isLowStock(p)) return { label: 'Low stock', cls: 'chip-warning' };
  return null;
}

function priceTrendHtml(p) {
  if (p.last_known_price == null) return '<span class="muted">No price yet</span>';
  const price = `₹${p.last_known_price}`;
  if (p.previous_price == null) return `<span>${price}</span> <span class="muted">(first price)</span>`;
  if (Number(p.last_known_price) > Number(p.previous_price)) {
    return `<span>${price}</span> <span class="trend-up" title="Up from ₹${p.previous_price}">▲</span>`;
  }
  if (Number(p.last_known_price) < Number(p.previous_price)) {
    return `<span>${price}</span> <span class="trend-down" title="Down from ₹${p.previous_price}">▼</span>`;
  }
  return `<span>${price}</span> <span class="muted" title="Unchanged since last time">–</span>`;
}

function renderProductList(container, listContainer, products) {
  if (products.length === 0) {
    listContainer.innerHTML = '<p class="muted">No products match this filter.</p>';
    return;
  }

  listContainer.innerHTML = `
    <div class="product-card-list">
      ${products
        .map((p) => {
          const status = stockStatus(p);
          const meta = [
            p.attributes?.size,
            p.attributes?.type,
            p.company,
          ].filter(Boolean).map(escapeHtmlLocal).join(' · ');

          return `
            <div class="product-card">
              <div class="product-card-main">
                <div>
                  <div class="product-card-name">${escapeHtmlLocal(p.name)}</div>
                  <div class="product-card-meta muted">${escapeHtmlLocal(p.category)}${meta ? ' · ' + meta : ''}</div>
                </div>
                ${status ? `<span class="status-chip ${status.cls}">${status.label}</span>` : ''}
              </div>
              <div class="product-card-footer">
                <span class="product-card-qty">${p.current_qty} ${escapeHtmlLocal(p.unit)}</span>
                <span class="product-card-price">${priceTrendHtml(p)}</span>
                <button type="button" class="btn-secondary history-btn" data-id="${p.id}" data-name="${escapeHtmlLocal(p.name)}">History</button>
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;

  listContainer.querySelectorAll('.history-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.Nav.push(
        renderProductHistory,
        [container, Number(btn.dataset.id), btn.dataset.name],
        { title: btn.dataset.name }
      );
    });
  });
}

// One product's full timeline: every quantity change and every price it's been
// bought at, merged into a single chronological list so the owner can see the
// whole story of a product at a glance rather than two disconnected tables.
async function renderProductHistory(container, productId, productName) {
  container.innerHTML = `<p class="muted">Loading history for ${escapeHtmlLocal(productName)}...</p>`;

  let data;
  try {
    data = await window.api.apiRequest(`/products/${productId}/history`);
  } catch (err) {
    container.innerHTML = `
      <p class="error-text visible">${err.message}</p>
      <button type="button" class="btn-secondary" id="history-back-btn">Back</button>
    `;
    document.getElementById('history-back-btn').addEventListener('click', () => history.back());
    return;
  }

  const { product, movements, priceHistory } = data;

  // Merge movements and price entries into one timeline, sorted newest first.
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
    <h1 class="title">${escapeHtmlLocal(product.name)}</h1>
    <p class="muted">Current stock: ${product.current_qty} ${product.unit} · Last price: ${product.last_known_price != null ? `₹${product.last_known_price}` : '-'}</p>
    <div style="margin-top: 16px; border-top: 2px solid #ccc;">
      ${rowsHtml}
    </div>
    <button type="button" class="btn-secondary" id="history-back-btn" style="margin-top: 20px;">Back</button>
  `;
  document.getElementById('history-back-btn').addEventListener('click', () => history.back());
}

function escapeHtmlLocal(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

window.renderDashboard = renderDashboard;
window.renderProductHistory = renderProductHistory;