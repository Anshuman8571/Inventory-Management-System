// Renders the category picker (CPVC / PVC / Paint) — shared by take-out and
// add-stock (sticker) flows, since both start with "which kind of product is this."

const CATEGORIES = ['CPVC', 'PVC', 'Paint'];

function renderCategorySelect(container, onSelect, isManualMode = false) {
  container.innerHTML = `
    <h1 class="title">${isManualMode ? 'Manual Entry: Select Category' : 'Select Category'}</h1>
    <div class="category-grid">
      ${CATEGORIES.map(
        (c) => `<button type="button" class="btn-category" data-category="${c}">${c}</button>`
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

window.renderCategorySelect = renderCategorySelect;