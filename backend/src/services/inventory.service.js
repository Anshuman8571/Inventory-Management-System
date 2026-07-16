// The ONLY place in the codebase that mutates stock quantities or writes stock_movements.
// Every confirm action — take-out, add-stock (sticker), and later bill bulk-confirm — must
// route through here, so stock logic never drifts between flows (see architecture.md §5).
//
// Wrapped in a DB transaction: either the whole confirm succeeds (product created/updated,
// quantity changed, movement logged, scan event marked confirmed) or none of it applies —
// partial application is not acceptable (see rules.md, error handling rules).

const db = require('../config/db');
const productsModel = require('../models/products.model');
const scanEventsModel = require('../models/scanEvents.model');
const stockMovementsModel = require('../models/stockMovements.model');

function makeError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.expose = true;
  return err;
}

async function confirmScanEvent({
  scanEventId,
  flowType,
  qty,
  isNewProduct,
  newProductDetails,
  correctedFields,
  confirmedByUserId,
}) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const scanEvent = await scanEventsModel.findByIdForUpdate(scanEventId, client);
    if (!scanEvent) {
      throw makeError('Scan not found.', 404, 'NOT_FOUND');
    }
    if (scanEvent.confirmed_by) {
      throw makeError('This scan has already been confirmed.', 409, 'ALREADY_CONFIRMED');
    }

    let productId = scanEvent.matched_product_id;

    if (isNewProduct) {
      if (!newProductDetails || !newProductDetails.name) {
        throw makeError('Product name is required to add a new product.', 400, 'INVALID_INPUT');
      }
      const created = await productsModel.create(
        {
          category: scanEvent.category_selected,
          name: newProductDetails.name,
          company: newProductDetails.company,
          unit: newProductDetails.unit,
          attributes: newProductDetails.attributes,
          initialQty: 0, // starts at 0, then the movement below applies the actual change
        },
        client
      );
      productId = created.id;
    }

    if (!productId) {
      throw makeError('No product to apply this scan to.', 400, 'INVALID_STATE');
    }

    const changeQty = flowType === 'take_out' ? -Math.abs(qty) : Math.abs(qty);

    const updatedProduct = await productsModel.incrementQty(productId, changeQty, client);

    // Guard against a take-out dropping stock below zero due to a stale count —
    // still allowed (physical stock may have been miscounted before), but this keeps
    // room to add a stronger warning/confirmation step later if that becomes a problem.
    if (updatedProduct.current_qty < 0) {
      console.warn(
        `Product ${productId} went negative after take-out (now ${updatedProduct.current_qty}). Allowed, but worth reviewing.`
      );
    }

    const movement = await stockMovementsModel.create(
      { productId, changeQty, scanEventId },
      client
    );

    const finalData = {
      productId,
      qty,
      isNewProduct,
      newProductDetails: newProductDetails || null,
      correctedFields: correctedFields || null,
    };

    await scanEventsModel.confirm(
      { id: scanEventId, finalData, qty, confirmedBy: confirmedByUserId },
      client
    );

    await client.query('COMMIT');

    return { product: updatedProduct, movement };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { confirmScanEvent };
