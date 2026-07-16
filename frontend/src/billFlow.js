// Handles Phase 4: Bulk bill processing flow

function startBillFlow(container) {
  captureAndScanBill(container);
}

async function captureAndScanBill(container) {
  container.innerHTML = `<p class="muted">Opening camera for bill scan...</p>`;

  let photo;
  try {
    photo = await window.capturePhoto();
  } catch (e) {
    if (window.renderHomeScreen) {
      window.renderHomeScreen(container);
    }
    return;
  }

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
    document.getElementById('retry-btn').addEventListener('click', () => captureAndScanBill(container));
    document.getElementById('cancel-btn').addEventListener('click', () => {
      if (window.renderHomeScreen) window.renderHomeScreen(container);
    });
    return;
  }

  renderBillTable(container, billResult);
}

function renderBillTable(container, billResult) {
  const { billId, supplierName, items } = billResult;
  
  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="status-card status-warning">
        <p class="status-label">No items found on this bill.</p>
      </div>
      <button type="button" class="btn-primary" id="retry-btn">Try Again</button>
      <button type="button" class="btn-secondary" id="cancel-btn">Cancel</button>
    `;
    document.getElementById('retry-btn').addEventListener('click', () => captureAndScanBill(container));
    document.getElementById('cancel-btn').addEventListener('click', () => {
      if (window.renderHomeScreen) window.renderHomeScreen(container);
    });
    return;
  }

  // Build the table
  let tableRows = items.map((item, index) => {
    const isNew = item.isNewProduct;
    const qty = item.rawExtracted.qty || 1;
    const name = item.match ? item.match.name : (item.rawExtracted.name || '');
    const statusText = isNew ? 'NEW' : 'MATCH';
    const statusClass = isNew ? 'status-warning' : 'status-success';

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
            <option value="CPVC">CPVC</option>
            <option value="PVC">PVC</option>
            <option value="Paint">Paint</option>
          </select>
        ` : ''}
        
        <label>Quantity</label>
        <input type="number" class="row-qty" value="${qty}" min="1" inputmode="numeric" />
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <h2 class="title">Review Bill</h2>
    <p class="muted" style="margin-bottom: 15px;">Supplier: <strong>${escapeHtml(supplierName || 'Unknown')}</strong></p>
    
    <div id="bill-items-container">
      ${tableRows}
    </div>

    <p id="bill-error" class="error-text"></p>

    <div style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
      <button type="button" class="btn-primary" id="confirm-bill-btn">Confirm All Items</button>
      <button type="button" class="btn-secondary" id="cancel-btn">Cancel</button>
    </div>
  `;

  document.getElementById('cancel-btn').addEventListener('click', () => {
    if (window.renderHomeScreen) window.renderHomeScreen(container);
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

        newProductDetails = {
          name: nameInput.value.trim(),
          category: catSelect.value,
          company: item.rawExtracted.company || undefined,
          attributes: {
            size: item.rawExtracted.size || undefined,
            type: item.rawExtracted.type || undefined
          }
        };
      }

      confirmedItems.push({
        id: item.id,
        qty,
        isNewProduct: item.isNewProduct,
        newProductDetails: item.isNewProduct ? newProductDetails : undefined,
        productId: item.isNewProduct ? undefined : item.match.productId
      });
    }

    // Submit
    try {
      const result = await window.api.apiRequest(`/bills/${billId}/confirm`, {
        method: 'POST',
        body: { items: confirmedItems },
      });
      showBillSuccess(container, result.processedCount);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.add('visible');
    }
  });
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
    if (window.renderHomeScreen) window.renderHomeScreen(container);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

window.startBillFlow = startBillFlow;
