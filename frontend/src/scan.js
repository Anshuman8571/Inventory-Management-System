// Orchestrates the Take-Out flow: category -> capture method -> photo -> confirm -> done.
// Add-Stock via individual sticker (Phase 3) reuses this exact function with
// flowType='add_stock' — no separate implementation (see architecture.md §5).

function startScanFlow(container, { flowType = 'take_out' } = {}) {
  renderCategorySelect(container, (category) => {
    window.Nav.push(renderCaptureChoice, [container, category, flowType], {
      title: 'Choose Photo',
    });
  });
}

// Lets the user pick Camera vs Gallery explicitly, rather than forcing one — see
// camera.js for why both need to exist (Android low-memory issue with forced camera).
function renderCaptureChoice(container, category, flowType) {
  container.innerHTML = `
    <h1 class="title">Take Photo of Sticker</h1>
    <div class="category-grid">
      <button type="button" class="btn-category" id="capture-camera-btn">📷 Take Photo</button>
      <button type="button" class="btn-category" id="capture-gallery-btn">🖼️ Choose from Gallery</button>
    </div>
  `;

  document
    .getElementById('capture-camera-btn')
    .addEventListener('click', () => captureAndScan(container, category, flowType, true));
  document
    .getElementById('capture-gallery-btn')
    .addEventListener('click', () => captureAndScan(container, category, flowType, false));
}

async function captureAndScan(container, category, flowType, useCamera) {
  container.innerHTML = `<p class="muted">Opening ${useCamera ? 'camera' : 'gallery'}...</p>`;

  let photo;
  try {
    photo = await window.capturePhoto({ useCamera });
  } catch (e) {
    // User cancelled or capture failed — go back to the method-choice screen, no error needed.
    renderCaptureChoice(container, category, flowType);
    return;
  }

  // Show the photo before sending it anywhere — retaking here costs nothing,
  // versus finding out after a round-trip to the reader that the shot was bad.
  window.renderPhotoPreview(container, photo, {
    onRetake: () => captureAndScan(container, category, flowType, useCamera),
    onUsePhoto: () => submitScan(container, category, flowType, useCamera, photo),
  });
}

async function submitScan(container, category, flowType, useCamera, photo) {
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
      .addEventListener('click', () => captureAndScan(container, category, flowType, useCamera));
    document
      .getElementById('manual-btn')
      .addEventListener('click', () => doManualEntry(container, category, flowType));
    return;
  }

  window.Nav.push(showConfirm, [container, scanResult, category, flowType, useCamera], {
    title: 'Confirm',
  });
}

async function doManualEntry(container, category, flowType) {
  container.innerHTML = `<p class="muted">Preparing manual entry...</p>`;
  try {
    const scanResult = await window.api.apiRequest('/scan', {
      method: 'POST',
      body: { category, flowType, isManual: true },
    });
    window.Nav.push(showConfirm, [container, scanResult, category, flowType, false], {
      title: 'Confirm',
    });
  } catch (err) {
    container.innerHTML = `<p class="error-text visible">Failed to start manual entry: ${err.message}</p>`;
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
      try {
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
        window.Nav.reset(showScanSuccess, [container, flowType], { title: 'Done' });
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
    .addEventListener('click', () =>
      window.Nav.push(startScanFlow, [container, { flowType }], { title: 'Take-Out', showBack: false })
    );
  document.getElementById('logout-btn-scan').addEventListener('click', () => {
    window.api.clearToken();
    window.location.reload();
  });
}

window.startScanFlow = startScanFlow;
window.doManualEntry = doManualEntry;