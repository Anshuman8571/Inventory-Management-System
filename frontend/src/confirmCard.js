// The shared confirmation UI — the status-colored card pattern used identically across
// take-out, add-stock (sticker), and later bill confirmation (see design.md §6, the
// app's "signature element"). Never auto-applies anything; always waits for the tap.

function renderConfirmCard(container, { extracted, isNewProduct, match, onConfirm, onRetake }) {
  const statusClass = isNewProduct ? 'status-warning' : 'status-success';
  const statusLabel = isNewProduct
    ? '⚠️ New product detected'
    : `✅ Matched: ${escapeHtml(match.name)}`;

  container.innerHTML = `
    <div class="status-card ${statusClass}">
      <p class="status-label">${statusLabel}</p>
      ${!isNewProduct ? `<p class="muted">Current stock: ${match.currentQty}</p>` : ''}
    </div>

    ${
      isNewProduct
        ? `
      <label for="new-name">Product name</label>
      <input type="text" id="new-name" value="${escapeHtml(extracted.name || '')}" />

      <label for="new-company">Company</label>
      <input type="text" id="new-company" value="${escapeHtml(extracted.company || '')}" />

      <label for="new-size">Size / Type</label>
      <input type="text" id="new-size" value="${escapeHtml(extracted.size || extracted.type || '')}" />
    `
        : ''
    }

    <label for="qty-input">Quantity</label>
    <input type="number" id="qty-input" min="1" value="1" inputmode="numeric" />

    <p id="confirm-error" class="error-text"></p>

    <button type="button" class="btn-primary" id="confirm-btn">Confirm</button>
    <button type="button" class="btn-secondary" id="retake-btn">Retake Photo</button>
  `;

  document.getElementById('retake-btn').addEventListener('click', onRetake);

  document.getElementById('confirm-btn').addEventListener('click', () => {
    const errorEl = document.getElementById('confirm-error');
    errorEl.textContent = '';
    errorEl.classList.remove('visible');

    const qty = Number(document.getElementById('qty-input').value);
    if (!qty || qty <= 0) {
      errorEl.textContent = 'Enter a valid quantity.';
      errorEl.classList.add('visible');
      return;
    }

    let newProductDetails = null;
    if (isNewProduct) {
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
    }

    onConfirm({ qty, newProductDetails });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

window.renderConfirmCard = renderConfirmCard;
