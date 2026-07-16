// Fuzzy-matches AI-extracted product text against existing products, scoped by category.
// Used identically by both the take-out and add-stock (sticker) flows.

const { distance } = require('fastest-levenshtein');
const productsModel = require('../models/products.model');

// Below this similarity score, a match is not confident enough to auto-apply —
// the item gets flagged as "new product" for human review instead (see rules.md:
// never auto-commit a fuzzy match below a defined confidence threshold).
const MATCH_THRESHOLD = 0.75;

function similarity(a, b) {
  const normA = (a || '').toLowerCase().trim();
  const normB = (b || '').toLowerCase().trim();
  if (!normA || !normB) return 0;
  const dist = distance(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  return maxLen === 0 ? 0 : 1 - dist / maxLen;
}

async function findBestMatch({ category, extractedName }) {
  const candidates = await productsModel.findByCategory(category);

  let best = null;
  let bestScore = 0;

  for (const product of candidates) {
    const score = similarity(extractedName, product.name);
    if (score > bestScore) {
      bestScore = score;
      best = product;
    }
  }

  if (best && bestScore >= MATCH_THRESHOLD) {
    return { product: best, score: Number(bestScore.toFixed(2)) };
  }
  return null; // caller treats this as "new product, needs review"
}

module.exports = { findBestMatch, MATCH_THRESHOLD };
