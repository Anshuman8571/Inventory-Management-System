// Handles the Take-Out flow (Phase 2). Phase 3 (Add-Stock via individual sticker) will
// call these exact same endpoints with flowType='add_stock' — no duplicate controller.

const extractionService = require('../services/extraction.service');
const matchingService = require('../services/matching.service');
const inventoryService = require('../services/inventory.service');
const scanEventsModel = require('../models/scanEvents.model');
const { scanRequestSchema, scanConfirmSchema } = require('../validators/scan.validator');

function makeError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.expose = true;
  return err;
}

// Step 1: photo + category in, extracted fields + best match (or "new product") out.
// Nothing is written to products/stock_movements here — only a pending scan_events row,
// since nothing should change inventory before a human confirms it (see rules.md).
async function createScan(req, res, next) {
  try {
    const parsed = scanRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw makeError('Category and photo are required.', 400, 'INVALID_INPUT');
    }
    const { category, imageBase64, mediaType, flowType } = parsed.data;

    const extracted = await extractionService.extractStickerFields({
      imageBase64,
      mediaType,
      category,
    });

    const match = await matchingService.findBestMatch({
      category,
      extractedName: extracted.name,
    });

    const scanEvent = await scanEventsModel.create({
      flowType,
      source: 'sticker',
      categorySelected: category,
      rawExtracted: extracted,
      matchedProductId: match ? match.product.id : null,
      isNewProduct: !match,
    });

    res.json({
      scanEventId: scanEvent.id,
      extracted,
      isNewProduct: !match,
      match: match
        ? {
            productId: match.product.id,
            name: match.product.name,
            currentQty: match.product.current_qty,
            score: match.score,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
}

// Step 2: human-confirmed data in, actual stock change out. Delegates all mutation
// logic to inventory.service.js — this controller only validates and passes through.
async function confirmScan(req, res, next) {
  try {
    const parsed = scanConfirmSchema.safeParse(req.body);
    if (!parsed.success) {
      throw makeError('Please check the quantity and product details.', 400, 'INVALID_INPUT');
    }

    const scanEventId = Number(req.params.id);
    if (!Number.isInteger(scanEventId)) {
      throw makeError('Invalid scan reference.', 400, 'INVALID_INPUT');
    }

    const scanEvent = await scanEventsModel.findById(scanEventId);
    if (!scanEvent) {
      throw makeError('Scan not found.', 404, 'NOT_FOUND');
    }

    const result = await inventoryService.confirmScanEvent({
      scanEventId,
      flowType: scanEvent.flow_type,
      qty: parsed.data.qty,
      isNewProduct: parsed.data.isNewProduct,
      newProductDetails: parsed.data.isNewProduct
        ? { category: scanEvent.category_selected, ...parsed.data.newProductDetails }
        : null,
      correctedFields: parsed.data.correctedFields,
      confirmedByUserId: req.user.userId,
    });

    res.json({ product: result.product, movement: result.movement });
  } catch (err) {
    next(err);
  }
}

module.exports = { createScan, confirmScan };
