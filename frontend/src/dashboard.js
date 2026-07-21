// Renders the Inventory Dashboard: search + category tabs, a
// pivot-table based product list with color-coded low-stock badges and price-trend
// arrows, and (via the deep dive) each product's full movement + price timeline
// and an Edit form to manage product details.

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

function isLowStock(p) {
  return p.low_stock_at != null && p.current_qty <= p.low_stock_at;
}

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
    
    const categoryProducts = products.filter(p => p.category === state.category);
    renderStats(categoryProducts);

    const filtered = categoryProducts.filter((p) => {
      if (state.lowStockOnly && p.current_qty > 0 && !isLowStock(p)) return false;
      if (term) {
        const haystack = `${p.name} ${p.company || ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    renderProductList(container, listContainer, filtered, state.category, products);
  }

  searchInput.addEventListener('input', (e) => {
    state.search = e.target.value;
    applyFilters();
  });

  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.category-tab');
    if (!btn) return;
    state.category = btn.dataset.category;
    tabsEl.querySelectorAll('.category-tab').forEach((b) => {
      b.classList.toggle('active', b === btn);
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

function renderProductList(container, listContainer, products, currentCategory, allProducts) {
  if (products.length === 0) {
    listContainer.innerHTML = '<p class="muted">No products match this filter.</p>';
    return;
  }

  const rows = {};
  const allVariations = new Set();
  
  for (const p of products) {
    const varName = getVariation(p);
    allVariations.add(varName);
    
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
    sortedVariations = CANONICAL_MAPPINGS[categoryKey].map(m => m.canonical);
    if (allVariations.has('Other')) {
      sortedVariations.push('Other');
    }
  } else {
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

  listContainer.querySelectorAll('.history-cell').forEach((cell) => {
    cell.addEventListener('click', () => {
      window.Nav.push(
        renderProductHistory,
        [container, Number(cell.dataset.id), cell.dataset.name],
        { title: cell.dataset.name }
      );
    });
  });

  listContainer.querySelectorAll('.product-family-row').forEach((cell) => {
    cell.addEventListener('click', () => {
      window.Nav.push(
        renderProductFamilyDeepDive,
        [container, cell.dataset.name, cell.dataset.company, allProducts],
        { title: cell.dataset.name }
      );
    });
  });
}

function renderProductFamilyDeepDive(container, name, company, products) {
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
      const product = products.find((p) => p.id === Number(btn.dataset.id));
      if (!product) return;
      window.Nav.push(renderProductEdit, [container, product], { title: 'Edit Product' });
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

function renderProductEdit(container, product) {
  const size = product.attributes?.size || '';

  container.innerHTML = `
    <h1 class="title">Edit Product</h1>
    <p class="muted" style="margin-bottom: 16px;">
      Current stock (${product.current_qty} ${escapeHtmlLocal(product.unit)}) and category can't be changed here —
      those go through a scan or a bill so the history stays accurate.
    </p>

    <label for="edit-name">Product name</label>
    <input type="text" id="edit-name" value="${escapeHtmlLocal(product.name)}" />

    <label for="edit-company">Company</label>
    <input type="text" id="edit-company" value="${escapeHtmlLocal(product.company || '')}" />

    <label for="edit-unit">Unit</label>
    <input type="text" id="edit-unit" value="${escapeHtmlLocal(product.unit || 'pcs')}" />

    <label for="edit-size">Size / Variant</label>
    <input type="text" id="edit-size" value="${escapeHtmlLocal(size)}" placeholder="e.g. 3/4 inch, 1L" />

    <label for="edit-low-stock">Low stock alert at</label>
    <input type="number" id="edit-low-stock" min="0" inputmode="numeric" value="${product.low_stock_at ?? 0}" />
    <p class="muted" style="margin: 4px 0 16px; font-size: 13px;">
      You'll see a "Low stock" badge on the dashboard once quantity drops to this number or below.
    </p>

    <p id="edit-error" class="error-text"></p>

    <button type="button" class="btn-primary" id="save-edit-btn">Save Changes</button>
    <button type="button" class="btn-danger" id="delete-btn" style="margin-top: 10px;">Delete</button>
    <button type="button" class="btn-secondary" id="cancel-edit-btn" style="margin-top: 10px;">Cancel</button>
  `;

  document.getElementById('cancel-edit-btn').addEventListener('click', () => history.back());

  document.getElementById('delete-btn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete this product? This will hide it from the dashboard.')) {
      return;
    }
    const errorEl = document.getElementById('edit-error');
    errorEl.textContent = '';
    errorEl.classList.remove('visible');

    const deleteBtn = document.getElementById('delete-btn');
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting...';

    try {
      await window.api.apiRequest(`/products/${product.id}`, { method: 'DELETE' });
      // Go back twice to return to the main dashboard
      history.go(-2);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.add('visible');
      deleteBtn.disabled = false;
      deleteBtn.textContent = 'Delete';
    }
  });

  document.getElementById('save-edit-btn').addEventListener('click', async () => {
    const errorEl = document.getElementById('edit-error');
    errorEl.textContent = '';
    errorEl.classList.remove('visible');

    const name = document.getElementById('edit-name').value.trim();
    if (!name) {
      errorEl.textContent = 'Product name is required.';
      errorEl.classList.add('visible');
      return;
    }

    const lowStockAt = Number(document.getElementById('edit-low-stock').value);
    if (!Number.isInteger(lowStockAt) || lowStockAt < 0) {
      errorEl.textContent = 'Low stock threshold must be 0 or a positive whole number.';
      errorEl.classList.add('visible');
      return;
    }

    const saveBtn = document.getElementById('save-edit-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      await window.api.apiRequest(`/products/${product.id}`, {
        method: 'PATCH',
        body: {
          name,
          company: document.getElementById('edit-company').value.trim(),
          unit: document.getElementById('edit-unit').value.trim() || 'pcs',
          lowStockAt,
          attributes: { size: document.getElementById('edit-size').value.trim() },
        },
      });
      history.back();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.add('visible');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  });
}

async function renderProductHistory(container, productId, productName) {
  container.innerHTML = `
    <h1 class="title">${escapeHtmlLocal(productName)}</h1>
    <p class="muted">Loading history...</p>
  `;

  let data;
  try {
    data = await window.api.apiRequest(`/products/${productId}/history`);
  } catch (err) {
    container.innerHTML = `
      <h1 class="title">${escapeHtmlLocal(productName)}</h1>
      <p class="error-text visible">${err.message}</p>
      <button class="btn-secondary" onclick="history.back()">Back</button>
    `;
    return;
  }

  const { product, movements, priceHistory } = data;

  const events = [
    ...movements.map((m) => ({ type: 'movement', date: m.created_at, ...m })),
    ...priceHistory.map((h) => ({ type: 'price', date: h.recorded_at, ...h })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const rowsHtml = events.length === 0
    ? '<p class="muted">No history yet for this product.</p>'
    : events.map((e) => {
        const dateStr = new Date(e.date).toLocaleString();
        if (e.type === 'movement') {
          const isIncrease = e.changeQty > 0;
          const sign = isIncrease ? '+' : '';
          const color = isIncrease ? 'var(--color-primary-dark)' : 'var(--color-error)';
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

window.renderDashboard = renderDashboard;
window.renderProductHistory = renderProductHistory;
window.renderProductEdit = renderProductEdit;