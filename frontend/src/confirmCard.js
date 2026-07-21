// The shared confirmation UI — the status-colored card pattern used identically across
// take-out, add-stock (sticker), and bill confirmation (see design.md §6, the app's
// "signature element"). Never auto-applies anything; always waits for the tap.
//
// When isNewProduct is true (a genuinely new item, OR manual entry after a failed scan),
// this also offers a dropdown to pick an EXISTING product instead — without this, manual
// entry always created a duplicate product rather than updating the real one.

async function renderConfirmCard(
  container,
  { extracted, isNewProduct, match, category, onConfirm, onRetake }
) {
  const statusClass = isNewProduct ? 'status-warning' : 'status-success';
  const statusLabel = isNewProduct
    ? '⚠️ New product detected'
    : `✅ Matched: ${escapeHtml(match.name)}`;

  let existingProducts = [];
  if (isNewProduct && category) {
    try {
      const result = await window.api.apiRequest('/products');
      existingProducts = (result.products || []).filter((p) => p.category === category);
    } catch (e) {
      existingProducts = []; // fall back to "create new only" if this lookup fails
    }
  }

  const existingOptionsHtml = existingProducts
    .map(
      (p) =>
        `<option value="${p.id}">${escapeHtml(p.name)} (current: ${p.current_qty} ${escapeHtml(p.unit)})</option>`
    )
    .join('');

  container.innerHTML = `
    ${window.homeButtonHtml ? window.homeButtonHtml() : ''}
    <div class="status-card ${statusClass}">
      <p class="status-label">${statusLabel}</p>
      ${!isNewProduct ? `<p class="muted">Current stock: ${match.currentQty}</p>` : ''}
    </div>

    ${
      isNewProduct && existingProducts.length > 0
        ? `
      <label for="existing-product-select">Or select an existing product</label>
      <select id="existing-product-select">
        <option value="">-- Create as new product --</option>
        ${existingOptionsHtml}
      </select>
    `
        : ''
    }

    <div id="new-product-fields" style="${isNewProduct ? '' : 'display:none;'}">
      ${
        isNewProduct
          ? `
        <label for="new-name">Product name</label>
        <input type="text" id="new-name" value="${escapeHtml(extracted.name || '')}" />

        <label for="new-company">Company</label>
        <input type="text" id="new-company" value="${escapeHtml(extracted.company || '')}" />

        <label for="new-size">Size / Type</label>
        <input type="text" id="new-size" value="${escapeHtml(extracted.size || extracted.type || '')}" />

        <label for="new-low-stock">Low stock alert at <span class="muted">(optional)</span></label>
        <input type="number" id="new-low-stock" min="0" inputmode="numeric" placeholder="e.g. 10" />
      `
          : ''
      }
    </div>

    <label for="qty-input">Quantity</label>
    <input type="number" id="qty-input" min="1" value="1" inputmode="numeric" />

    <p id="confirm-error" class="error-text"></p>

    <button type="button" class="btn-primary" id="confirm-btn">Confirm</button>
    <button type="button" class="btn-secondary" id="retake-btn">Retake Photo</button>
  `;

  if (window.attachHomeButton) window.attachHomeButton(container);

  document.getElementById('retake-btn').addEventListener('click', onRetake);

  const existingSelect = document.getElementById('existing-product-select');
  const newProductFields = document.getElementById('new-product-fields');
  if (existingSelect) {
    existingSelect.addEventListener('change', () => {
      const usingExisting = !!existingSelect.value;
      newProductFields.style.display = usingExisting ? 'none' : '';
    });
  }

  const confirmBtn = document.getElementById('confirm-btn');

  confirmBtn.addEventListener('click', async () => {
    const errorEl = document.getElementById('confirm-error');
    errorEl.textContent = '';
    errorEl.classList.remove('visible');

    const qty = Number(document.getElementById('qty-input').value);
    if (!qty || qty <= 0) {
      errorEl.textContent = 'Enter a valid quantity.';
      errorEl.classList.add('visible');
      return;
    }

    const selectedProductId =
      existingSelect && existingSelect.value ? Number(existingSelect.value) : null;

    let newProductDetails = null;
    if (isNewProduct && !selectedProductId) {
      const name = document.getElementById('new-name').value.trim();
      if (!name) {
        errorEl.textContent = 'Product name is required.';
        errorEl.classList.add('visible');
        return;
      }
      newProductDetails = {
        name,
        company: document.getElementById('new-company').value.trim() || undefined,
        attributes: { size: document.getElementById('new-size').value.trim() || undefined },
      };
      const lowStockInput = document.getElementById('new-low-stock').value.trim();
      if (lowStockInput !== '') {
        const lowStockAt = Number(lowStockInput);
        if (!Number.isInteger(lowStockAt) || lowStockAt < 0) {
          errorEl.textContent = 'Low stock threshold must be 0 or a positive whole number.';
          errorEl.classList.add('visible');
          return;
        }
        newProductDetails.lowStockAt = lowStockAt;
      }
    }

    // Disable + relabel while submitting so a slow connection can't be double-tapped
    // into confirming the same thing twice.
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Confirming...';

    try {
      await onConfirm({ qty, newProductDetails, selectedProductId });
    } catch (err) {
      errorEl.textContent = err.message || 'Something went wrong. Please try again.';
      errorEl.classList.add('visible');
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirm';
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

window.renderConfirmCard = renderConfirmCard;