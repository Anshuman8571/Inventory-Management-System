const productsModel = require('../models/products.model');
const stockMovementsModel = require('../models/stockMovements.model');
const priceHistoryModel = require('../models/priceHistory.model');

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

module.exports = { getProducts, getHistory };