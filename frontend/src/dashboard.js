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
  const categoriesPresent = [...new Set(products.map((p) => p.category))].sort();
  const state = { 
    search: '', 
    category: categoriesPresent.length > 0 ? categoriesPresent[0] : '',
    lowStockOnly: false 
  };

  container.innerHTML = `
    <h1 class="title" style="margin-bottom: 4px;">Inventory Dashboard</h1>
    
    <div id="dash-stats-container"></div>

    <div class="dash-toolbar">
      <input
        type="text"
        id="dash-search"
        class="dash-search"
        placeholder="Search by name or company..."
        ${products.length === 0 ? 'disabled' : ''}
      />
      <div class="category-tabs" id="dash-category-tabs">
        ${categoriesPresent
          .map((c) => `<button type="button" class="category-tab ${c === state.category ? 'active' : ''}" data-category="${escapeHtmlLocal(c)}">${escapeHtmlLocal(c)}</button>`)
          .join('')}
        ${categoriesPresent.length > 0 ? `<button type="button" class="category-tab" id="dash-edit-category" style="background: transparent; border: 1px dashed var(--color-primary-dark); padding: 4px 8px;">⚙️ Edit</button>` : ''}
      </div>
      <button type="button" class="low-stock-toggle" id="dash-low-stock-toggle">
        ⚠️ Low Stock & Out of Stock
      </button>
    </div>

    <div id="dash-list-container"></div>
  `;

  const searchInput = document.getElementById('dash-search');
  const listContainer = document.getElementById('dash-list-container');
  const statsContainer = document.getElementById('dash-stats-container');
  const tabsEl = document.getElementById('dash-category-tabs');
  const lowStockToggle = document.getElementById('dash-low-stock-toggle');

  function renderStats(filteredProducts) {
    const totalItems = filteredProducts.length;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    
    for (const p of filteredProducts) {
      if (p.current_qty <= 0) outOfStockCount++;
      else if (isLowStock(p)) lowStockCount++;
    }

    statsContainer.innerHTML = `
      <div class="stats-bar">
        <div class="stat-card">
          <div class="stat-value">${totalItems}</div>
          <div class="stat-label">Total Items</div>
        </div>
        <div class="stat-card ${lowStockCount > 0 ? 'stat-warning' : ''}">
          <div class="stat-value">${lowStockCount}</div>
          <div class="stat-label">Low Stock</div>
        </div>
        <div class="stat-card ${outOfStockCount > 0 ? 'stat-critical' : ''}">
          <div class="stat-value">${outOfStockCount}</div>
          <div class="stat-label">Out of Stock</div>
        </div>
      </div>
    `;
  }

  function applyFilters() {
    const term = state.search.trim().toLowerCase();
    
    // Base products for the currently selected category
    const categoryProducts = products.filter(p => p.category === state.category);
    
    // Update the top stats strictly based on the selected category
    renderStats(categoryProducts);

    const filtered = categoryProducts.filter((p) => {
      // Include out-of-stock items in the low-stock filter for maximum utility
      if (state.lowStockOnly && p.current_qty > 0 && !isLowStock(p)) return false;
      if (term) {
        const haystack = `${p.name} ${p.company || ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    renderProductList(container, listContainer, filtered, state.category);
  }

  searchInput.addEventListener('input', (e) => {
    state.search = e.target.value;
    applyFilters();
  });

  tabsEl.addEventListener('click', (e) => {
    if (e.target.id === 'dash-edit-category') {
      window.Nav.push(renderCategoryEditor, [container, state.category], { title: 'Edit Category' });
      return;
    }

    const btn = e.target.closest('.category-tab');
    if (!btn) return;
    state.category = btn.dataset.category;
    tabsEl.querySelectorAll('.category-tab').forEach((b) => {
      if (b.id !== 'dash-edit-category') b.classList.toggle('active', b === btn);
    });
    applyFilters();
  });

  lowStockToggle.addEventListener('click', () => {
    state.lowStockOnly = !state.lowStockOnly;
    lowStockToggle.classList.toggle('active', state.lowStockOnly);
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

const CANONICAL_MAPPINGS = {
  'CPVC': [
    { canonical: '3/4 inch', matches: ['3/4', '20 mm', '20mm'] },
    { canonical: '1 inch', matches: ['1 inch', '1"', "1'", '25 mm', '25mm'] },
    { canonical: '1 1/4 inch', matches: ['1 1/4', '1.25', '32 mm', '32mm'] },
    { canonical: '1 1/2 inch', matches: ['1 1/2', '1.5', '40 mm', '40mm'] }
  ],
  'PPR': [
    { canonical: '20mm', matches: ['20mm', '20 mm', '20x', '20 x'] },
    { canonical: '25mm', matches: ['25mm', '25 mm', '25x', '25 x'] },
    { canonical: '32mm', matches: ['32mm', '32 mm', '32x', '32 x'] }
  ],
  'Prince': [
    { canonical: '20mm', matches: ['20mm', '20 mm', '20x', '20 x'] },
    { canonical: '25mm', matches: ['25mm', '25 mm', '25x', '25 x'] },
    { canonical: '32mm', matches: ['32mm', '32 mm', '32x', '32 x'] }
  ],
  'Supreme': [
    { canonical: '40mm', matches: ['40mm', '40 mm', '40x', '1.25"', "1.25'", '1 1/4'] },
    { canonical: '50mm', matches: ['50mm', '50 mm', '50x', '1.5"', "1.5'", '1 1/2'] },
    { canonical: '75mm', matches: ['75mm', '75 mm', '75x', '2.5"', "2.5'", '3"', "3'"] },
    { canonical: '110mm', matches: ['110mm', '110 mm', '110x', '4"', "4'"] },
    { canonical: '140mm', matches: ['140mm', '140 mm', '140x', '5"', "5'"] },
    { canonical: '160mm', matches: ['160mm', '160 mm', '160x', '6"', "6'"] }
  ]
};

function getVariation(p) {
  const text = (p.name + ' ' + (p.attributes?.size || '')).toLowerCase();
  
  let mappingList = null;
  for (const key of Object.keys(CANONICAL_MAPPINGS)) {
    if ((p.category || '').toLowerCase().includes(key.toLowerCase())) {
      mappingList = CANONICAL_MAPPINGS[key];
      break;
    }
  }

  if (mappingList) {
    for (const mapping of mappingList) {
      if (mapping.matches.some(m => text.includes(m))) {
        return mapping.canonical;
      }
    }
    return 'Other';
  }

  return [p.attributes?.size, p.attributes?.type].filter(Boolean).join(' ') || 'Standard';
}

function renderProductList(container, listContainer, products, currentCategory = '') {
  if (products.length === 0) {
    listContainer.innerHTML = '<p class="muted">No products match this filter.</p>';
    return;
  }

  const rows = {};
  const allVariations = new Set();
  
  for (const p of products) {
    const varName = getVariation(p);
    allVariations.add(varName);
    
    // Group by name + company to keep different brands separate
    const key = p.company ? `${p.name}___${p.company}` : p.name;
    if (!rows[key]) rows[key] = { name: p.name, company: p.company, items: {}, unit: p.unit };
    rows[key].items[varName] = p;
  }

  let categoryKey = null;
  for (const key of Object.keys(CANONICAL_MAPPINGS)) {
    if (currentCategory.toLowerCase().includes(key.toLowerCase())) {
      categoryKey = key;
      break;
    }
  }

  let sortedVariations = [];
  if (categoryKey) {
    // Force the exact canonical columns for this category
    sortedVariations = CANONICAL_MAPPINGS[categoryKey].map(m => m.canonical);
    if (allVariations.has('Other')) {
      sortedVariations.push('Other');
    }
  } else {
    // Natural sort for sizes dynamically
    sortedVariations = Array.from(allVariations).sort((a, b) => {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  const sortedKeys = Object.keys(rows).sort((a, b) => a.localeCompare(b));

  const hideTotal = ['ppr', 'prince'].some(k => currentCategory.toLowerCase().includes(k));

  let theadHtml = `<tr><th class="pivot-name-header">Product</th>`;
  sortedVariations.forEach(v => {
    theadHtml += `<th>${escapeHtmlLocal(v)}</th>`;
  });
  if (!hideTotal) {
    theadHtml += `<th>Total</th>`;
  }
  theadHtml += `</tr>`;

  let tbodyHtml = '';
  for (const key of sortedKeys) {
    const row = rows[key];
    let rowTotal = 0;
    
    let rowCellsHtml = '';
    for (const v of sortedVariations) {
      const p = row.items[v];
      if (!p) {
        rowCellsHtml += `<td class="pivot-cell-empty">-</td>`;
      } else {
        rowTotal += p.current_qty;
        
        let dotHtml = '';
        let cellClass = '';
        if (p.current_qty <= 0) {
          dotHtml = `<span class="pivot-row-dot pivot-cell-critical"></span>`;
          cellClass = 'pivot-cell-critical';
        } else if (isLowStock(p)) {
          dotHtml = `<span class="pivot-row-dot pivot-cell-warning"></span>`;
          cellClass = 'pivot-cell-warning';
        }
        
        // Make individual cells clickable to see their specific history
        rowCellsHtml += `<td class="pivot-cell-qty ${cellClass} history-cell" data-id="${p.id}" data-name="${escapeHtmlLocal(p.name)} ${escapeHtmlLocal(v)}" style="cursor: pointer;">${dotHtml}${p.current_qty}</td>`;
      }
    }
    
    const displayName = row.company 
      ? `${escapeHtmlLocal(row.name)} <div class="muted" style="font-size:10px; font-weight:normal;">${escapeHtmlLocal(row.company)}</div>` 
      : escapeHtmlLocal(row.name);

    tbodyHtml += `
      <tr>
        <td class="pivot-name-cell product-family-row" data-name="${escapeHtmlLocal(row.name)}" data-company="${escapeHtmlLocal(row.company || '')}">${displayName}</td>
        ${rowCellsHtml}
        ${!hideTotal ? `<td class="pivot-total-col pivot-cell-qty">${rowTotal} <span style="font-size:10px; font-weight:normal; color:var(--color-text-muted)">${escapeHtmlLocal(row.unit)}</span></td>` : ''}
      </tr>
    `;
  }

  listContainer.innerHTML = `
    <div class="pivot-table-wrapper">
      <table class="pivot-table">
        <thead>${theadHtml}</thead>
        <tbody>${tbodyHtml}</tbody>
      </table>
    </div>
  `;

  // Click listener for individual variation cells (existing history view)
  listContainer.querySelectorAll('.history-cell').forEach((cell) => {
    cell.addEventListener('click', () => {
      window.Nav.push(
        renderProductHistory,
        [container, Number(cell.dataset.id), cell.dataset.name],
        { title: cell.dataset.name }
      );
    });
  });

  // Click listener for the product name (Part 3 - Family deep dive)
  listContainer.querySelectorAll('.product-family-row').forEach((cell) => {
    cell.addEventListener('click', () => {
      window.Nav.push(
        renderProductFamilyDeepDive,
        [container, cell.dataset.name, cell.dataset.company, products],
        { title: cell.dataset.name }
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
    ? '<p class="muted" style="padding: 10px;">No history yet for this product.</p>'
    : events.map((e) => {
        const dateStr = new Date(e.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
        if (e.type === 'movement') {
          const isIncrease = e.changeQty > 0;
          const sign = isIncrease ? '+' : '';
          const color = isIncrease ? 'var(--color-success, #2E7D5B)' : 'var(--color-error, #B33A3A)';
          return `
            <div style="padding: 14px 10px; border-bottom: 1px solid #EFECE4; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 13px; font-weight: 600; color: var(--color-text);">Stock Movement</div>
                <div class="muted" style="font-size: 11px; margin-top: 4px;">${dateStr}</div>
              </div>
              <span style="color: ${color}; font-weight: 700; font-variant-numeric: tabular-nums; font-size: 16px;">
                ${sign}${e.changeQty} ${escapeHtmlLocal(product.unit)}
              </span>
            </div>
          `;
        }
        return `
          <div style="padding: 14px 10px; border-bottom: 1px solid #EFECE4; display: flex; justify-content: space-between; align-items: center; background: #FAF9F6;">
            <div>
              <div style="font-size: 13px; font-weight: 600; color: var(--color-text);">Price Recorded</div>
              <div class="muted" style="font-size: 11px; margin-top: 4px;">${dateStr}</div>
            </div>
            <span style="font-weight: 700; font-variant-numeric: tabular-nums; font-size: 16px; color: var(--color-primary-dark);">
              ₹${e.price}
            </span>
          </div>
        `;
      }).join('');

  container.innerHTML = `
    <h1 class="title" style="margin-bottom: 6px;">${escapeHtmlLocal(productName)}</h1>
    <p class="muted" style="font-size: 13px;">
      Current stock: <strong style="color: var(--color-text)">${product.current_qty} ${escapeHtmlLocal(product.unit)}</strong> · 
      Last price: <strong style="color: var(--color-text)">${product.last_known_price != null ? `₹${product.last_known_price}` : '-'}</strong>
    </p>
    <div style="margin-top: 24px; border: 1px solid #E5E2D9; border-radius: 10px; overflow: hidden;">
      <div style="background: var(--color-surface); padding: 10px 14px; border-bottom: 1px solid #E5E2D9; font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--color-text-muted); letter-spacing: 0.05em;">
        History Ledger
      </div>
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

async function renderProductFamilyDeepDive(container, name, company, products) {
  const familyProducts = products.filter(p => p.name === name && (p.company || '') === company);
  
  familyProducts.sort((a, b) => getVariation(a).localeCompare(getVariation(b), undefined, { numeric: true, sensitivity: 'base' }));

  const companyHtml = company ? `<p class="muted" style="margin-top:-5px; font-weight: 500;">${escapeHtmlLocal(company)}</p>` : '';

  container.innerHTML = `
    <h1 class="title" style="margin-bottom:8px">${escapeHtmlLocal(name)}</h1>
    ${companyHtml}
    
    <div class="product-card-list" style="margin-top: 20px;">
      ${familyProducts.map(p => {
        const variation = getVariation(p);
        const status = stockStatus(p);
        return `
          <div class="product-card">
            <div class="product-card-main">
              <div>
                <div class="product-card-name">${escapeHtmlLocal(variation)}</div>
                <div class="product-card-meta muted">Stock ID: ${p.id}</div>
              </div>
              ${status ? `<span class="status-chip ${status.cls}">${status.label}</span>` : ''}
            </div>
            <div class="product-card-footer">
              <span class="product-card-qty">${p.current_qty} ${escapeHtmlLocal(p.unit)}</span>
              <span class="product-card-price">${priceTrendHtml(p)}</span>
              <div style="display: flex; gap: 8px;">
                <button type="button" class="btn-secondary edit-btn" data-id="${p.id}" style="padding: 4px 8px;">Edit</button>
                <button type="button" class="btn-secondary history-btn" data-id="${p.id}" data-name="${escapeHtmlLocal(p.name)} ${escapeHtmlLocal(variation)}">History</button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <button type="button" class="btn-secondary" id="deep-dive-back-btn" style="margin-top: 20px;">Back</button>
  `;

  container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.Nav.push(
        renderProductEditor,
        [container, Number(btn.dataset.id)],
        { title: 'Edit Product' }
      );
    });
  });

  container.querySelectorAll('.history-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.Nav.push(
        renderProductHistory,
        [container, Number(btn.dataset.id), btn.dataset.name],
        { title: btn.dataset.name }
      );
    });
  });

  document.getElementById('deep-dive-back-btn').addEventListener('click', () => history.back());
}

async function renderProductEditor(container, productId) {
  container.innerHTML = `<p class="muted">Loading product details...</p>`;
  let data;
  try {
    data = await window.api.apiRequest(`/products/${productId}/history`);
  } catch (err) {
    container.innerHTML = `<p class="error-text visible">${err.message}</p><button class="btn-secondary" onclick="history.back()">Back</button>`;
    return;
  }
  const product = data.product;

  container.innerHTML = `
    <h1 class="title">Edit Product</h1>
    <p class="muted">Make changes to product details or delete it.</p>
    <form id="edit-product-form" style="display: flex; flex-direction: column; gap: 12px; margin-top: 16px;">
      <label class="input-label" style="text-align:left">Name <span style="color:red">*</span>
        <input type="text" name="name" class="input" value="${escapeHtmlLocal(product.name)}" required>
      </label>
      <label class="input-label" style="text-align:left">Company
        <input type="text" name="company" class="input" value="${escapeHtmlLocal(product.company || '')}">
      </label>
      <label class="input-label" style="text-align:left">Category <span style="color:red">*</span>
        <input type="text" name="category" class="input" value="${escapeHtmlLocal(product.category)}" required>
      </label>
      <div style="display:flex; gap:12px">
        <label class="input-label" style="text-align:left; flex:1">Size
          <input type="text" name="size" class="input" value="${escapeHtmlLocal(product.attributes?.size || '')}">
        </label>
        <label class="input-label" style="text-align:left; flex:1">Type / Base
          <input type="text" name="type" class="input" value="${escapeHtmlLocal(product.attributes?.type || '')}">
        </label>
      </div>
      <div style="display:flex; gap:12px">
        <label class="input-label" style="text-align:left; flex:1">Current Qty <span style="color:red">*</span>
          <input type="number" name="current_qty" class="input" min="0" value="${product.current_qty}" required>
        </label>
        <label class="input-label" style="text-align:left; flex:1">Unit <span style="color:red">*</span>
          <input type="text" name="unit" class="input" value="${escapeHtmlLocal(product.unit)}" required>
        </label>
      </div>
      <p id="edit-error" class="error-text" style="margin-top: 8px;"></p>
      <div style="display: flex; gap: 12px; margin-top: 12px;">
        <button type="submit" class="btn-primary" style="flex: 1;" id="btn-save">Save Changes</button>
        <button type="button" class="btn-secondary" onclick="history.back()" style="flex: 1;">Cancel</button>
      </div>
      <button type="button" class="btn-secondary" id="btn-delete" style="margin-top: 24px; color: var(--color-error); border-color: var(--color-error);">Delete Product</button>
    </form>
  `;

  const form = document.getElementById('edit-product-form');
  const errorEl = document.getElementById('edit-error');
  const btnSave = document.getElementById('btn-save');
  const btnDelete = document.getElementById('btn-delete');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.remove('visible');
    btnSave.disabled = true;
    btnSave.textContent = 'Saving...';

    const fd = new FormData(form);
    const payload = {
      name: fd.get('name').trim(),
      company: fd.get('company').trim() || null,
      category: fd.get('category').trim(),
      unit: fd.get('unit').trim(),
      current_qty: parseInt(fd.get('current_qty'), 10),
      attributes: {
        ...product.attributes,
        size: fd.get('size').trim() || undefined,
        type: fd.get('type').trim() || undefined,
      }
    };

    try {
      await window.api.apiRequest(`/products/${product.id}`, {
        method: 'PUT',
        body: payload
      });
      // Force hard reload of the dashboard to pick up changes
      window.location.reload();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.add('visible');
      btnSave.disabled = false;
      btnSave.textContent = 'Save Changes';
    }
  });

  btnDelete.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) return;
    
    btnDelete.disabled = true;
    btnDelete.textContent = 'Deleting...';
    try {
      await window.api.apiRequest(`/products/${product.id}`, { method: 'DELETE' });
      window.location.reload();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.add('visible');
      btnDelete.disabled = false;
      btnDelete.textContent = 'Delete Product';
    }
  });
}

async function renderCategoryEditor(container, categoryName) {
  container.innerHTML = `
    <h1 class="title">Edit Category</h1>
    <p class="muted">Rename or delete the category: <strong>${escapeHtmlLocal(categoryName)}</strong></p>
    <form id="edit-category-form" style="display: flex; flex-direction: column; gap: 12px; margin-top: 16px;">
      <label class="input-label" style="text-align:left">Category Name <span style="color:red">*</span>
        <input type="text" name="name" class="input" value="${escapeHtmlLocal(categoryName)}" required maxlength="40">
      </label>
      <p id="cat-edit-error" class="error-text" style="margin-top: 8px;"></p>
      <div style="display: flex; gap: 12px; margin-top: 12px;">
        <button type="submit" class="btn-primary" style="flex: 1;" id="cat-btn-save">Save Changes</button>
        <button type="button" class="btn-secondary" onclick="history.back()" style="flex: 1;">Cancel</button>
      </div>
      <button type="button" class="btn-secondary" id="cat-btn-delete" style="margin-top: 24px; color: var(--color-error); border-color: var(--color-error);">Delete Category</button>
    </form>
  `;

  const form = document.getElementById('edit-category-form');
  const errorEl = document.getElementById('cat-edit-error');
  const btnSave = document.getElementById('cat-btn-save');
  const btnDelete = document.getElementById('cat-btn-delete');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.remove('visible');
    btnSave.disabled = true;
    btnSave.textContent = 'Saving...';

    const newName = new FormData(form).get('name').trim();
    if (newName === categoryName) {
      history.back();
      return;
    }

    try {
      await window.api.apiRequest(`/categories/${encodeURIComponent(categoryName)}`, {
        method: 'PUT',
        body: { newName }
      });
      window.location.reload();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.add('visible');
      btnSave.disabled = false;
      btnSave.textContent = 'Save Changes';
    }
  });

  btnDelete.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete this category? All products in this category will also be deleted or orphaned. This action cannot be undone.')) return;
    
    btnDelete.disabled = true;
    btnDelete.textContent = 'Deleting...';
    try {
      await window.api.apiRequest(`/categories/${encodeURIComponent(categoryName)}`, { method: 'DELETE' });
      window.location.reload();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.add('visible');
      btnDelete.disabled = false;
      btnDelete.textContent = 'Delete Category';
    }
  });
}

window.renderDashboard = renderDashboard;
window.renderProductHistory = renderProductHistory;