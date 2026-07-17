// Renders the Inventory Dashboard to view all products, their current quantities,
// and last known purchase price (from the bill flow's price tracking).

async function renderDashboard(container) {
  container.innerHTML = `
    <h1 class="title">Inventory Dashboard</h1>
    <p class="muted">Loading inventory...</p>
    <button type="button" class="btn-secondary" id="back-btn" style="margin-top: 20px;">Back to Scanning</button>
  `;

  document.getElementById('back-btn').addEventListener('click', () => {
    window.startScanFlow(container, { flowType: 'take_out' });
  });

  try {
    const { products } = await window.api.apiRequest('/products');
    
    if (products.length === 0) {
      container.innerHTML = `
        <h1 class="title">Inventory Dashboard</h1>
        <p class="muted">No products found in inventory.</p>
        <button type="button" class="btn-secondary" id="back-btn" style="margin-top: 20px;">Back to Scanning</button>
      `;
      document.getElementById('back-btn').addEventListener('click', () => {
        window.startScanFlow(container, { flowType: 'take_out' });
      });
      return;
    }

    let tableHtml = `
      <table class="inventory-table" style="width: 100%; text-align: left; margin-top: 20px; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 2px solid #ccc;">
            <th style="padding: 10px;">Product Name</th>
            <th style="padding: 10px;">Category</th>
            <th style="padding: 10px;">Size</th>
            <th style="padding: 10px;">Type</th>
            <th style="padding: 10px;">Company</th>
            <th style="padding: 10px; text-align: right;">Last Price</th>
            <th style="padding: 10px; text-align: right;">Current Qty</th>
          </tr>
        </thead>
        <tbody>
    `;

    products.forEach(p => {
      const isLowStock = p.low_stock_at && p.current_qty <= p.low_stock_at;
      const rowStyle = isLowStock ? 'background-color: #fdf5e6;' : ''; // Warning color for low stock
      const priceDisplay = p.last_known_price != null ? `₹${p.last_known_price}` : '-';
      
      tableHtml += `
        <tr style="border-bottom: 1px solid #eee; ${rowStyle}">
          <td style="padding: 10px; font-weight: bold;">${p.name}</td>
          <td style="padding: 10px;">${p.category}</td>
          <td style="padding: 10px;">${p.attributes?.size || '-'}</td>
          <td style="padding: 10px;">${p.attributes?.type || '-'}</td>
          <td style="padding: 10px;">${p.company || '-'}</td>
          <td style="padding: 10px; text-align: right; font-variant-numeric: tabular-nums;">${priceDisplay}</td>
          <td style="padding: 10px; text-align: right; font-weight: bold; font-variant-numeric: tabular-nums;">
            ${p.current_qty} ${p.unit}
            ${isLowStock ? ' ⚠️' : ''}
          </td>
        </tr>
      `;
    });

    tableHtml += `
        </tbody>
      </table>
    `;

    container.innerHTML = `
      <h1 class="title">Inventory Dashboard</h1>
      <div style="overflow-x: auto;">
        ${tableHtml}
      </div>
      <button type="button" class="btn-secondary" id="back-btn" style="margin-top: 20px;">Back to Scanning</button>
    `;
    
    document.getElementById('back-btn').addEventListener('click', () => {
      window.startScanFlow(container, { flowType: 'take_out' });
    });

  } catch (err) {
    container.innerHTML = `
      <h1 class="title">Inventory Dashboard</h1>
      <p class="error-text visible">Failed to load inventory: ${err.message}</p>
      <button type="button" class="btn-secondary" id="back-btn" style="margin-top: 20px;">Back to Scanning</button>
    `;
    document.getElementById('back-btn').addEventListener('click', () => {
      window.startScanFlow(container, { flowType: 'take_out' });
    });
  }
}

window.renderDashboard = renderDashboard;