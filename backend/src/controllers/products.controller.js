const productsModel = require('../models/products.model');
const stockMovementsModel = require('../models/stockMovements.model');
const priceHistoryModel = require('../models/priceHistory.model');
const { productUpdateSchema } = require('../validators/products.validator');

function makeError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.expose = true;
  return err;
}

async function getProducts(req, res, next) {
  try {
    const products = await productsModel.list();
    res.json({ products });
  } catch (err) {
    next(err);
  }
}

// Per-product movement + price history — the last piece of the owner-reporting view
// (see phases.md, Phase 6). Combines both ledgers so the owner can see the full
// timeline for one product: every quantity change and every price it's been bought at.
async function getHistory(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      throw makeError('Invalid product reference.', 400, 'INVALID_INPUT');
    }

    const product = await productsModel.findById(id);
    if (!product) {
      throw makeError('Product not found.', 404, 'NOT_FOUND');
    }

    const [movements, priceHistory] = await Promise.all([
      stockMovementsModel.findByProduct(id),
      priceHistoryModel.findByProduct(id),
    ]);

    res.json({ product, movements, priceHistory });
  } catch (err) {
    next(err);
  }
}

// Fixes a mis-scanned entry (wrong name/size/company) or sets a reorder threshold
// after the fact. Deliberately does NOT touch current_qty, category, or price —
// those have their own dedicated, audited paths (stock movements, bill confirm) and
// changing them here would bypass that trail.
async function updateProduct(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      throw makeError('Invalid product reference.', 400, 'INVALID_INPUT');
    }

    const parsed = productUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw makeError(parsed.error.issues[0]?.message || 'Invalid input.', 400, 'INVALID_INPUT');
    }

    const existing = await productsModel.findById(id);
    if (!existing) {
      throw makeError('Product not found.', 404, 'NOT_FOUND');
    }

    const updated = await productsModel.update(id, parsed.data);
    res.json({ product: updated });
  } catch (err) {
    next(err);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      throw makeError('Invalid product reference.', 400, 'INVALID_INPUT');
    }

    const existing = await productsModel.findById(id);
    if (!existing) {
      throw makeError('Product not found.', 404, 'NOT_FOUND');
    }

    await productsModel.softDelete(id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProducts, getHistory, updateProduct, deleteProduct };