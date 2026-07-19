// Renders the category picker (CPVC / PVC / Paint) — shared by take-out and
// add-stock (sticker) flows, since both start with "which kind of product is this."

const CATEGORIES = ['CPVC', 'PVC', 'Paint'];

function renderCategorySelect(container, onSelect) {
  container.innerHTML = `
    ${window.homeButtonHtml ? window.homeButtonHtml() : ''}
    <h1 class="title">Select Category</h1>
    <div class="category-grid">
      ${CATEGORIES.map(
        (c) => `<button type="button" class="btn-category" data-category="${c}">${c}</button>`
      ).join('')}
    </div>
  `;

  if (window.attachHomeButton) window.attachHomeButton(container);

  container.querySelectorAll('.btn-category').forEach((btn) => {
    btn.addEventListener('click', () => onSelect(btn.dataset.category));
  });
}

window.renderCategorySelect = renderCategorySelect;