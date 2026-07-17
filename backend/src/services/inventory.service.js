// The ONLY place in the codebase that mutates stock quantities or writes stock_movements.
// Every confirm action — take-out, add-stock (sticker), and bill bulk-confirm — must
// route through here, so stock logic never drifts between flows (see architecture.md §5).
//
// Wrapped in a DB transaction: either the whole confirm succeeds or none of it applies —
// partial application is not acceptable (see rules.md, error handling rules).

const db = require('../config/db');
const productsModel = require('../models/products.model');
const scanEventsModel = require('../models/scanEvents.model');
const stockMovementsModel = require('../models/stockMovements.model');
const billsModel = require('../models/bills.model');
const pricingService = require('./pricing.service');

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
  selectedProductId,
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

    // selectedProductId lets the confirm step target an existing product directly —
    // used when manual entry (or a failed/incorrect match) should update a real
    // product's stock instead of always creating a new one.
    let productId = selectedProductId || scanEvent.matched_product_id;

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

async function confirmBillEvent({ billId, items, confirmedByUserId }) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    for (const item of items) {
      // Lock + check "already confirmed" first — without this, a duplicate/retried
      // confirm request could double-apply the same line item's stock change.
      const lineItem = await billsModel.findLineItemForUpdate(item.id, client);
      if (!lineItem) {
        throw makeError(`Bill line item ${item.id} not found.`, 404, 'NOT_FOUND');
      }
      if (lineItem.confirmed) {
        continue; // already applied earlier — skip silently, don't double-add stock
      }

      let productId = item.productId;

      if (item.isNewProduct) {
        if (!item.newProductDetails || !item.newProductDetails.name || !item.newProductDetails.category) {
          throw makeError(
            'Product name and category are required to add a new product.',
            400,
            'INVALID_INPUT'
          );
        }
        const created = await productsModel.create(
          {
            category: item.newProductDetails.category,
            name: item.newProductDetails.name,
            company: item.newProductDetails.company,
            unit: item.newProductDetails.unit,
            attributes: item.newProductDetails.attributes,
            initialQty: 0,
          },
          client
        );
        productId = created.id;
      }

      if (!productId) {
        throw makeError('No product to apply this line item to.', 400, 'INVALID_STATE');
      }

      // Bill flow is always "add_stock"
      const changeQty = Math.abs(item.qty);
      await productsModel.incrementQty(productId, changeQty, client);

      await stockMovementsModel.create(
        { productId, changeQty, scanEventId: null },
        client
      );

      // Record the price this item was bought at, using the price captured at upload
      // time (lineItem.unit_price) — same transaction as the stock change, so price
      // and stock history never drift apart from each other.
      await pricingService.recordPrice({
        productId,
        newPrice: lineItem.unit_price,
        billId,
        client,
      });

      await billsModel.updateBillLineItem(item.id, { confirmedQty: item.qty, confirmed: true }, client);
    }

    await client.query('COMMIT');
    return { success: true, count: items.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { confirmScanEvent, confirmBillEvent };