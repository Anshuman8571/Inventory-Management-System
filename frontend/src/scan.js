// Orchestrates the Take-Out flow: category -> photo -> confirm -> done.
// Add-Stock via individual sticker (Phase 3) reuses this exact function with
// flowType='add_stock' — no separate implementation (see architecture.md §5).

function startScanFlow(container, { flowType = 'take_out' } = {}) {
  renderCategorySelect(container, (category) => {
    captureAndScan(container, category, flowType);
  });
}

async function captureAndScan(container, category, flowType) {
  container.innerHTML = `<p class="muted">Opening camera...</p>`;

  let photo;
  try {
    photo = await window.capturePhoto();
  } catch (e) {
    // User cancelled or camera failed — just go back to category select, no error needed.
    renderCategorySelect(container, (c) => captureAndScan(container, c, flowType));
    return;
  }

  container.innerHTML = `<p class="muted">Reading sticker...</p>`;

  let scanResult;
  try {
    scanResult = await window.api.apiRequest('/scan', {
      method: 'POST',
      body: {
        category,
        imageBase64: photo.base64,
        mediaType: photo.mediaType,
        flowType,
      },
    });
  } catch (err) {
    container.innerHTML = `
      <p class="error-text visible">${err.message}</p>
      <button type="button" class="btn-primary" id="retry-btn">Try Again</button>
      <button type="button" class="btn-secondary" id="manual-btn" style="margin-top: 10px;">Enter Manually</button>
    `;
    document
      .getElementById('retry-btn')
      .addEventListener('click', () => captureAndScan(container, category, flowType));
    document
      .getElementById('manual-btn')
      .addEventListener('click', () => doManualEntry(container, category, flowType));
    return;
  }

  showConfirm(container, scanResult, category, flowType);
}

async function doManualEntry(container, category, flowType) {
  container.innerHTML = `<p class="muted">Preparing manual entry...</p>`;
  try {
    const scanResult = await window.api.apiRequest('/scan', {
      method: 'POST',
      body: { category, flowType, isManual: true },
    });
    showConfirm(container, scanResult, category, flowType);
  } catch (err) {
    container.innerHTML = `<p class="error-text visible">Failed to start manual entry: ${err.message}</p>`;
  }
}

function showConfirm(container, scanResult, category, flowType) {
  renderConfirmCard(container, {
    extracted: scanResult.extracted,
    isNewProduct: scanResult.isNewProduct,
    match: scanResult.match,
    onRetake: () => captureAndScan(container, category, flowType),
    onConfirm: async ({ qty, newProductDetails }) => {
      try {
        await window.api.apiRequest(`/scan/${scanResult.scanEventId}/confirm`, {
          method: 'POST',
          body: {
            qty,
            isNewProduct: scanResult.isNewProduct,
            newProductDetails: scanResult.isNewProduct ? newProductDetails : undefined,
          },
        });
        showScanSuccess(container, flowType);
      } catch (err) {
        const errorEl = document.getElementById('confirm-error');
        if (errorEl) {
          errorEl.textContent = err.message;
          errorEl.classList.add('visible');
        }
      }
    },
  });
}

function showScanSuccess(container, flowType) {
  container.innerHTML = `
    <div class="status-card status-success">
      <p class="status-label">✅ Updated</p>
    </div>
    <button type="button" class="btn-primary" id="scan-next-btn">Scan Next Item</button>
    <button type="button" class="btn-secondary" id="logout-btn-scan">Log Out</button>
  `;
  document
    .getElementById('scan-next-btn')
    .addEventListener('click', () => startScanFlow(container, { flowType }));
  document.getElementById('logout-btn-scan').addEventListener('click', () => {
    window.api.clearToken();
    window.location.reload();
  });
}

window.startScanFlow = startScanFlow;
window.doManualEntry = doManualEntry;
