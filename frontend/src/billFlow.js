// Handles Phase 4: Bulk bill processing flow

function startBillFlow(container) {
  renderBillCaptureChoice(container);
}

// Same Camera-vs-Gallery choice as scan.js, for the same reason (see camera.js).
function renderBillCaptureChoice(container) {
  container.innerHTML = `
    <h1 class="title">Photograph Supplier Bill</h1>
    <div class="category-grid">
      <button type="button" class="btn-category" id="bill-capture-camera-btn">📷 Take Photo</button>
      <button type="button" class="btn-category" id="bill-capture-gallery-btn">🖼️ Choose from Gallery</button>
    </div>
  `;

  document
    .getElementById('bill-capture-camera-btn')
    .addEventListener('click', () => captureAndScanBill(container, true));
  document
    .getElementById('bill-capture-gallery-btn')
    .addEventListener('click', () => captureAndScanBill(container, false));
}

async function captureAndScanBill(container, useCamera) {
  container.innerHTML = `<p class="muted">Opening ${useCamera ? 'camera' : 'gallery'}...</p>`;

  let photo;
  try {
    photo = await window.capturePhoto({ useCamera });
  } catch (e) {
    renderBillCaptureChoice(container);
    return;
  }

  // Same preview-before-submit step as the single-sticker flow — a bill photo is
  // more expensive to re-process than a sticker, so catching a bad shot here matters more.
  window.renderPhotoPreview(container, photo, {
    onRetake: () => captureAndScanBill(container, useCamera),
    onUsePhoto: () => submitBillPhoto(container, useCamera, photo),
    useLabel: 'Use Photo',
  });
}

async function submitBillPhoto(container, useCamera, photo) {
  container.innerHTML = `<p class="muted">Reading supplier bill... this may take a few moments...</p>`;

  let billResult;
  try {
    billResult = await window.api.apiRequest('/bills', {
      method: 'POST',
      body: {
        imageBase64: photo.base64,
        mediaType: photo.mediaType,
      },
    });
  } catch (err) {
    container.innerHTML = `
      <p class="error-text visible">${err.message}</p>
      <button type="button" class="btn-primary" id="retry-btn">Try Again</button>
      <button type="button" class="btn-secondary" id="cancel-btn" style="margin-top: 10px;">Cancel</button>
    `;
    document.getElementById('retry-btn').addEventListener('click', () => captureAndScanBill(container, useCamera));
    document.getElementById('cancel-btn').addEventListener('click', () => {
      window.Nav.goHome();
    });
    return;
  }

  window.Nav.push(renderBillTable, [container, billResult], { title: 'Review Bill' });
}

async function renderBillTable(container, billResult) {
  const { billId, supplierName, items } = billResult;

  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="status-card status-warning">
        <p class="status-label">No items found on this bill.</p>
      </div>
      <button type="button" class="btn-primary" id="retry-btn">Try Again</button>
      <button type="button" class="btn-secondary" id="cancel-btn">Cancel</button>
    `;
    document.getElementById('retry-btn').addEventListener('click', () => renderBillCaptureChoice(container));
    document.getElementById('cancel-btn').addEventListener('click', () => {
      window.Nav.goHome();
    });
    return;
  }

  // Categories are fetched (not hardcoded) so a category created elsewhere in the
  // app — or via "+ Add new" below — shows up here too.
  let categories = [];
  try {
    const result = await window.api.apiRequest('/categories');
    categories = result.categories || [];
  } catch (e) {
    categories = []; // Falls back to just the "+ Add new" option below.
  }

  function categoryOptionsHtml(selectedVal) {
    let options = `<option value="" disabled ${!selectedVal ? 'selected' : ''}>-- Select Category --</option>`;
    options += categories.map(c => 
      `<option value="${escapeHtml(c.name)}" ${c.name === selectedVal ? 'selected' : ''}>${escapeHtml(c.path)}</option>`
    ).join('');
    return options + `<option value="__new__">+ Add new category...</option>`;
  }

  // Build the table
  let tableRows = items.map((item, index) => {
    const isNew = item.isNewProduct;
    const qty = item.rawExtracted.qty || 1;
    const name = item.match ? item.match.name : (item.rawExtracted.name || '');
    const statusText = isNew ? 'NEW' : 'MATCH';
    const statusClass = isNew ? 'status-warning' : 'status-success';
    const priceHtml = renderPriceInfo(item.priceInfo);
    // Bill extraction doesn't guess a category per line (bills mix categories —
    // see matchingService.findBestMatch's category: null above) so this just
    // defaults to the first category and leaves it to the user to correct.
    const defaultCategory = categories[0] ? categories[0].name : '';

    return `
      <div class="bill-row" data-index="${index}" style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span class="${statusClass}" style="padding: 2px 6px; font-size: 12px; border-radius: 4px;">${statusText}</span>
          ${!isNew ? `<span style="font-size: 12px; color: #666;">Current: ${item.match.currentQty}</span>` : ''}
        </div>

        <label>Product Name</label>
        <input type="text" class="row-name" value="${escapeHtml(name)}" ${!isNew ? 'readonly' : ''} />

        ${isNew ? `
          <label>Category</label>
          <select class="row-category">
            ${categoryOptionsHtml(defaultCategory)}
          </select>

          <label>Low stock alert at <span class="muted">(optional)</span></label>
          <input type="number" class="row-low-stock" min="0" inputmode="numeric" placeholder="e.g. 10" />
        ` : ''}

        <label>Quantity</label>
        <input type="number" class="row-qty" value="${qty}" min="1" inputmode="numeric" />

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
          <div>
            <label>Base Rate (₹)</label>
            <input type="number" class="row-price" value="${item.rawExtracted.unitPrice || item.rawExtracted.price || ''}" step="0.01" />
          </div>
          <div>
            <label>HSN Code</label>
            <input type="text" class="row-hsn" value="${escapeHtml(item.rawExtracted.hsnCode || '')}" />
          </div>
          <div>
            <label>Trade Disc (%)</label>
            <input type="number" class="row-trade-disc" value="${item.rawExtracted.tradeDiscount || ''}" step="0.01" />
          </div>
          <div>
            <label>Scheme Disc (%)</label>
            <input type="number" class="row-scheme-disc" value="${item.rawExtracted.schemeDiscount || ''}" step="0.01" />
          </div>
          <div>
            <label>GST (%)</label>
            <input type="number" class="row-gst" value="${item.rawExtracted.gstPercent || ''}" step="0.01" />
          </div>
        </div>

        ${priceHtml}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <h2 class="title">Review Bill</h2>
    <p class="muted" style="margin-bottom: 15px;">Supplier: <strong>${escapeHtml(supplierName || 'Unknown')}</strong></p>

    <div id="bill-items-container">
      ${tableRows}
    </div>

    <div class="bill-summary-card" id="bill-summary-card"></div>

    <p id="bill-error" class="error-text"></p>

    <div style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
      <button type="button" class="btn-primary" id="confirm-bill-btn">Confirm All Items</button>
      <button type="button" class="btn-secondary" id="cancel-btn">Cancel</button>
    </div>
  `;

  // Keeps the totals visible and accurate as the user edits quantities/categories,
  // rather than only finding out the total at (or after) the final tap.
  function updateSummary() {
    const rows = container.querySelectorAll('.bill-row');
    let totalQty = 0;
    let newCount = 0;
    rows.forEach((row) => {
      const idx = Number(row.dataset.index);
      const qty = Number(row.querySelector('.row-qty').value) || 0;
      totalQty += qty;
      if (items[idx].isNewProduct) newCount += 1;
    });
    document.getElementById('bill-summary-card').innerHTML = `
      <div class="bill-summary-row"><span>Line items</span><span>${rows.length}</span></div>
      <div class="bill-summary-row"><span>Total quantity</span><span>${totalQty}</span></div>
      <div class="bill-summary-row"><span>New products</span><span>${newCount}</span></div>
    `;
  }

  document.getElementById('bill-items-container').addEventListener('input', (e) => {
    if (e.target.classList.contains('row-qty')) updateSummary();
  });
  updateSummary();

  // "+ Add new category..." in a row's dropdown — prompts for a name, creates it,
  // and selects it in that row. Kept as a quick native prompt rather than a full
  // inline form (like the main category-select screen has) since this is a
  // secondary path inside an already-dense bulk-review table.
  document.getElementById('bill-items-container').addEventListener('change', async (e) => {
    const select = e.target;
    if (!select.classList.contains('row-category') || select.value !== '__new__') return;

    // Use a custom modal instead of window.prompt to avoid mobile blocking issues
    const uniqueId = Date.now();
    const modalHtml = `
      <div id="category-modal-${uniqueId}" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;">
        <div style="background: white; padding: 20px; border-radius: 8px; width: 100%; max-width: 400px; color: #333;">
          <h3 style="margin-top: 0;">Create New Category</h3>
          
          <label style="display: block; margin-top: 15px;">Category Name</label>
          <input type="text" class="cat-name-input row-qty" style="width: 100%; box-sizing: border-box;" placeholder="e.g. Interior Emulsion" />
          
          <label style="display: block; margin-top: 15px;">Parent Category (Optional)</label>
          <select class="cat-parent-input" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; background: white;">
            <option value="">-- None (Top Level) --</option>
            ${categories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.path)}</option>`).join('')}
          </select>
          
          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
            <button class="cat-cancel-btn btn-secondary" style="padding: 8px 16px;">Cancel</button>
            <button class="cat-save-btn btn-primary" style="padding: 8px 16px;">Save</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById(`category-modal-${uniqueId}`);
    const nameInput = modal.querySelector('.cat-name-input');
    const parentInput = modal.querySelector('.cat-parent-input');
    
    // Focus the input
    setTimeout(() => nameInput.focus(), 100);

    const cleanup = () => {
      modal.remove();
    };

    const handleSave = async () => {
      const name = nameInput.value.trim();
      if (!name) {
        alert('Please enter a category name.');
        return;
      }
      
      const parentName = parentInput.value || null;
      
      try {
        const { category } = await window.api.apiRequest('/categories', {
          method: 'POST',
          body: { name, parentName },
        });
        
        if (!categories.find(c => c.name === category.name)) categories.push(category);
        
        // Add new category to ALL category dropdowns in the UI so it's available everywhere
        document.querySelectorAll('.row-category').forEach(sel => {
          const option = document.createElement('option');
          option.value = category.name;
          option.textContent = category.path;
          sel.insertBefore(option, sel.lastElementChild);
        });

        // Set the current select to the newly created category
        select.value = category.name;
        cleanup();
      } catch (err) {
        alert(err.message);
      }
    };

    modal.querySelector('.cat-cancel-btn').addEventListener('click', () => {
      select.value = categories[0] ? categories[0].name : '';
      cleanup();
    });

    modal.querySelector('.cat-save-btn').addEventListener('click', handleSave);
  });

  document.getElementById('cancel-btn').addEventListener('click', () => {
    window.Nav.goHome();
  });

  document.getElementById('confirm-bill-btn').addEventListener('click', async () => {
    const errorEl = document.getElementById('bill-error');
    errorEl.textContent = '';
    errorEl.classList.remove('visible');

    const confirmedItems = [];
    const rows = container.querySelectorAll('.bill-row');

    for (const row of rows) {
      const idx = Number(row.dataset.index);
      const item = items[idx];
      const qtyInput = row.querySelector('.row-qty');
      const qty = Number(qtyInput.value);

      if (!qty || qty <= 0) {
        errorEl.textContent = 'All items must have a valid quantity.';
        errorEl.classList.add('visible');
        return;
      }

      let newProductDetails;
      if (item.isNewProduct) {
        const nameInput = row.querySelector('.row-name');
        const catSelect = row.querySelector('.row-category');

        if (!nameInput.value.trim()) {
          errorEl.textContent = 'All new products must have a name.';
          errorEl.classList.add('visible');
          return;
        }

        if (!catSelect.value || catSelect.value === '__new__') {
          errorEl.textContent = `Please select a valid category for "${nameInput.value.trim()}".`;
          errorEl.classList.add('visible');
          return;
        }

        newProductDetails = {
          name: nameInput.value.trim(),
          category: catSelect.value,
          company: item.rawExtracted.company || undefined,
          attributes: {
            size: item.rawExtracted.size || undefined,
            type: item.rawExtracted.type || undefined
          }
        };

        const lowStockInput = row.querySelector('.row-low-stock').value.trim();
        if (lowStockInput !== '') {
          const lowStockAt = Number(lowStockInput);
          if (!Number.isInteger(lowStockAt) || lowStockAt < 0) {
            errorEl.textContent = `Low stock threshold for "${nameInput.value.trim()}" must be 0 or a positive whole number.`;
            errorEl.classList.add('visible');
            return;
          }
          newProductDetails.lowStockAt = lowStockAt;
        }
      }

      const priceInput = row.querySelector('.row-price');
      const hsnInput = row.querySelector('.row-hsn');
      const tradeDiscInput = row.querySelector('.row-trade-disc');
      const schemeDiscInput = row.querySelector('.row-scheme-disc');
      const gstInput = row.querySelector('.row-gst');

      confirmedItems.push({
        id: item.id,
        qty,
        isNewProduct: item.isNewProduct,
        newProductDetails: item.isNewProduct ? newProductDetails : undefined,
        productId: item.isNewProduct ? undefined : item.match.productId,
        unitPrice: priceInput.value ? Number(priceInput.value) : null,
        hsnCode: hsnInput.value ? hsnInput.value.trim() : null,
        tradeDiscount: tradeDiscInput.value ? Number(tradeDiscInput.value) : null,
        schemeDiscount: schemeDiscInput.value ? Number(schemeDiscInput.value) : null,
        gstPercent: gstInput.value ? Number(gstInput.value) : null,
      });
    }

    // Submit
    try {
      const result = await window.api.apiRequest(`/bills/${billId}/confirm`, {
        method: 'POST',
        body: { items: confirmedItems },
      });
      window.Nav.reset(showBillSuccess, [container, result.processedCount], { title: 'Done' });
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.add('visible');
    }
  });
}

// Renders the price-comparison line for a bill row, if price info is available.
function renderPriceInfo(priceInfo) {
  if (!priceInfo || priceInfo.newPrice == null) {
    return '<p class="muted" style="margin-top:6px;">No price detected on this line.</p>';
  }
  const { previousPrice, newPrice, changeType } = priceInfo;
  if (changeType === 'first') {
    return `<p class="muted" style="margin-top:6px;">Price: ₹${newPrice} (first time seeing this item)</p>`;
  }
  if (changeType === 'same') {
    return `<p class="muted" style="margin-top:6px;">Price: ₹${newPrice} (same as last time)</p>`;
  }
  if (changeType === 'increase') {
    return `<p style="margin-top:6px; color: var(--color-warning, #C77B23);">⚠️ Price: ₹${newPrice} (up from ₹${previousPrice})</p>`;
  }
  if (changeType === 'decrease') {
    return `<p style="margin-top:6px; color: var(--color-success, #2E7D5B);">Price: ₹${newPrice} (down from ₹${previousPrice})</p>`;
  }
  return `<p class="muted" style="margin-top:6px;">Price: ₹${newPrice}</p>`;
}

function showBillSuccess(container, count) {
  container.innerHTML = `
    <div class="status-card status-success">
      <p class="status-label">✅ Success</p>
      <p class="muted">Added ${count} items to inventory.</p>
    </div>
    <button type="button" class="btn-primary" id="back-home-btn" style="margin-top:20px;">Back to Menu</button>
  `;
  document.getElementById('back-home-btn').addEventListener('click', () => {
    window.Nav.goHome();
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

window.startBillFlow = startBillFlow;