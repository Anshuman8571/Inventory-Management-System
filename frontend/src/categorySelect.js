// Renders the category picker — shared by take-out and
// add-stock (sticker) flows, since both start with "which kind of product is this."

async function renderCategorySelect(container, onSelect, isManualMode = false) {
  let categories = [];
  try {
    const result = await window.api.apiRequest('/categories');
    // For this top-level selector, let's just pick top-level categories (no parent),
    // or all categories if the hierarchy is flattened. Let's just use paths.
    categories = result.categories || [];
  } catch (e) {
    categories = [{name: 'CPVC', path: 'CPVC'}, {name: 'SWR', path: 'SWR'}, {name: 'Paint', path: 'Paint'}];
  }

  container.innerHTML = `
    <h1 class="title">${isManualMode ? 'Manual Entry: Select Category' : 'Select Category'}</h1>
    <div class="category-grid" style="grid-template-columns: 1fr;">
      ${categories.map(
        (c) => `<button type="button" class="btn-category" data-category="${escapeHtml(c.name)}">${escapeHtml(c.path)}</button>`
      ).join('')}
    </div>
    <div style="margin-top: 30px; text-align: center;">
      <button type="button" class="btn-secondary" id="back-home-btn">Back to Menu</button>
    </div>
  `;

  container.querySelectorAll('.btn-category').forEach((btn) => {
    btn.addEventListener('click', () => onSelect(btn.dataset.category));
  });

  document.getElementById('back-home-btn').addEventListener('click', () => {
    history.back();
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

window.renderCategorySelect = renderCategorySelect;