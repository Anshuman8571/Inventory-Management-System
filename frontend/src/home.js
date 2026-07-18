function renderHomeScreen(container, role) {
  const isOwner = role === 'owner';

  container.innerHTML = `
    <h1 class="title">Main Menu</h1>
    <div style="display: flex; flex-direction: column; gap: 15px;">
      <button type="button" class="btn-primary" id="home-take-out-btn">Take-Out (Deduct Stock)</button>
      <button type="button" class="btn-primary" id="home-add-stock-btn">Add Stock (Single Sticker)</button>
      <button type="button" class="btn-primary" id="home-add-bill-btn">Add Stock (Supplier Bill)</button>
      <button type="button" class="btn-secondary" id="home-manual-btn">Enter Product Manually</button>
      <button type="button" class="btn-secondary" id="view-inventory-btn">View Inventory Dashboard</button>
      ${isOwner ? '<button type="button" class="btn-secondary" id="view-reports-btn">View Reports</button>' : ''}
      <button type="button" class="btn-secondary" id="logout-btn" style="margin-top: 20px;">Log Out</button>
    </div>
  `;

  document.getElementById('home-take-out-btn').addEventListener('click', () => {
    if (window.startScanFlow) window.startScanFlow(container, { flowType: 'take_out' });
  });

  document.getElementById('home-add-stock-btn').addEventListener('click', () => {
    if (window.startScanFlow) window.startScanFlow(container, { flowType: 'add_stock' });
  });

  document.getElementById('home-add-bill-btn').addEventListener('click', () => {
    if (window.startBillFlow) window.startBillFlow(container);
    else alert('Bill flow coming soon!');
  });

  document.getElementById('home-manual-btn').addEventListener('click', () => {
    if (window.renderCategorySelect) {
      window.renderCategorySelect(container, (category) => {
        if (window.doManualEntry) {
          window.doManualEntry(container, category, 'take_out'); // Defaults to take_out for manual, could prompt but take_out is safe default
        }
      });
    }
  });

  document.getElementById('view-inventory-btn').addEventListener('click', () => {
    if (window.renderDashboard) {
      window.renderDashboard(container);
    }
  });

  if (isOwner) {
    const reportsBtn = document.getElementById('view-reports-btn');
    if (reportsBtn) {
      reportsBtn.addEventListener('click', () => {
        if (window.renderReports) window.renderReports(container);
      });
    }
  }

  document.getElementById('logout-btn').addEventListener('click', () => {
    window.api.clearToken();
    window.location.reload();
  });
}

window.renderHomeScreen = renderHomeScreen;