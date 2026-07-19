// Orchestrates the Take-Out flow: category -> capture method -> photo -> confirm -> done.
// Add-Stock via individual sticker (Phase 3) reuses this exact function with
// flowType='add_stock' — no separate implementation (see architecture.md §5).

function startScanFlow(container, { flowType = 'take_out' } = {}) {
  renderCategorySelect(container, (category) => {
    renderCaptureChoice(container, category, flowType);
  });
}

// Lets the user pick Camera vs Gallery explicitly, rather than forcing one — see
// camera.js for why both need to exist (Android low-memory issue with forced camera).
function renderCaptureChoice(container, category, flowType) {
  container.innerHTML = `
    ${window.homeButtonHtml ? window.homeButtonHtml() : ''}
    <h1 class="title">Take Photo of Sticker</h1>
    <div class="category-grid">
      <button type="button" class="btn-category" id="capture-camera-btn">📷 Take Photo</button>
      <button type="button" class="btn-category" id="capture-gallery-btn">🖼️ Choose from Gallery</button>
    </div>
    <button type="button" class="btn-secondary" id="capture-back-btn">Back</button>
  `;

  if (window.attachHomeButton) window.attachHomeButton(container);

  document
    .getElementById('capture-camera-btn')
    .addEventListener('click', () => captureAndScan(container, category, flowType, true));
  document
    .getElementById('capture-gallery-btn')
    .addEventListener('click', () => captureAndScan(container, category, flowType, false));
  document
    .getElementById('capture-back-btn')
    .addEventListener('click', () =>
      renderCategorySelect(container, (c) => renderCaptureChoice(container, c, flowType))
    );
}

async function captureAndScan(container, category, flowType, useCamera) {
  container.innerHTML = `
    ${window.homeButtonHtml ? window.homeButtonHtml() : ''}
    <p class="muted">Opening ${useCamera ? 'camera' : 'gallery'}...</p>
  `;
  if (window.attachHomeButton) window.attachHomeButton(container);

  let photo;
  try {
    photo = await window.capturePhoto({ useCamera });
  } catch (e) {
    // User cancelled or capture failed — go back to the method-choice screen, no error needed.
    renderCaptureChoice(container, category, flowType);
    return;
  }

  container.innerHTML = `
    ${window.homeButtonHtml ? window.homeButtonHtml() : ''}
    <p class="muted">Reading sticker...</p>
  `;
  if (window.attachHomeButton) window.attachHomeButton(container);

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
      ${window.homeButtonHtml ? window.homeButtonHtml() : ''}
      <p class="error-text visible">${err.message}</p>
      <button type="button" class="btn-primary" id="retry-btn">Try Again</button>
      <button type="button" class="btn-secondary" id="manual-btn" style="margin-top: 10px;">Enter Manually</button>
    `;
    if (window.attachHomeButton) window.attachHomeButton(container);
    document
      .getElementById('retry-btn')
      .addEventListener('click', () => captureAndScan(container, category, flowType, useCamera));
    document
      .getElementById('manual-btn')
      .addEventListener('click', () => doManualEntry(container, category, flowType));
    return;
  }

  showConfirm(container, scanResult, category, flowType, useCamera);
}

async function doManualEntry(container, category, flowType) {
  container.innerHTML = `
    ${window.homeButtonHtml ? window.homeButtonHtml() : ''}
    <p class="muted">Preparing manual entry...</p>
  `;
  if (window.attachHomeButton) window.attachHomeButton(container);

  try {
    const scanResult = await window.api.apiRequest('/scan', {
      method: 'POST',
      body: { category, flowType, isManual: true },
    });
    showConfirm(container, scanResult, category, flowType, false);
  } catch (err) {
    container.innerHTML = `
      ${window.homeButtonHtml ? window.homeButtonHtml() : ''}
      <p class="error-text visible">Failed to start manual entry: ${err.message}</p>
    `;
    if (window.attachHomeButton) window.attachHomeButton(container);
  }
}

function showConfirm(container, scanResult, category, flowType, useCamera) {
  renderConfirmCard(container, {
    extracted: scanResult.extracted,
    isNewProduct: scanResult.isNewProduct,
    match: scanResult.match,
    category, // needed so confirmCard.js can offer "select an existing product" scoped correctly
    onRetake: () => captureAndScan(container, category, flowType, useCamera),
    onConfirm: async ({ qty, newProductDetails, selectedProductId }) => {
      await window.api.apiRequest(`/scan/${scanResult.scanEventId}/confirm`, {
        method: 'POST',
        body: {
          qty,
          // If the user picked an existing product from the dropdown, this always
          // targets that product directly, regardless of what the scan/manual-entry
          // step originally flagged (see memory.md: manual entry duplicate-product fix).
          isNewProduct: selectedProductId ? false : scanResult.isNewProduct,
          newProductDetails:
            !selectedProductId && scanResult.isNewProduct ? newProductDetails : undefined,
          selectedProductId: selectedProductId || undefined,
        },
      });
      showScanSuccess(container, flowType);
    },
  });
}

function showScanSuccess(container, flowType) {
  const role = window.api.getRole();
  container.innerHTML = `
    ${window.homeButtonHtml ? window.homeButtonHtml() : ''}
    <div class="status-card status-success">
      <p class="status-label">✅ Updated</p>
    </div>
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <button type="button" class="btn-primary" id="scan-next-btn">Scan Next Item</button>
      <button type="button" class="btn-secondary" id="view-inventory-btn-success">View Inventory</button>
      <button type="button" class="btn-secondary" id="go-home-btn-success">Go to Home</button>
      <button type="button" class="btn-secondary" id="logout-btn-scan">Log Out</button>
    </div>
  `;
  if (window.attachHomeButton) window.attachHomeButton(container);

  document
    .getElementById('scan-next-btn')
    .addEventListener('click', () => startScanFlow(container, { flowType }));
  document.getElementById('view-inventory-btn-success').addEventListener('click', () => {
    if (window.renderDashboard) window.renderDashboard(container);
  });
  document.getElementById('go-home-btn-success').addEventListener('click', () => {
    if (window.renderHomeScreen) window.renderHomeScreen(container, role);
  });
  document.getElementById('logout-btn-scan').addEventListener('click', () => {
    window.api.clearToken();
    window.location.reload();
  });
}

window.startScanFlow = startScanFlow;
window.doManualEntry = doManualEntry;