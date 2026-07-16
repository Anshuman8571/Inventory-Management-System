const extractionService = require('../services/extraction.service');
const matchingService = require('../services/matching.service');
const inventoryService = require('../services/inventory.service');
const billsModel = require('../models/bills.model');
const { z } = require('zod');

const uploadBillSchema = z.object({
  imageBase64: z.string().min(1, 'Photo is required'),
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
});

const confirmBillSchema = z.object({
  items: z.array(z.object({
    id: z.number().int().positive(),
    qty: z.number().int().positive(),
    isNewProduct: z.boolean().default(false),
    newProductDetails: z.object({
      category: z.string().min(1),
      name: z.string().min(1),
      company: z.string().optional(),
      unit: z.string().optional(),
      attributes: z.record(z.any()).optional(),
    }).optional(),
    productId: z.number().int().positive().optional(),
  })).min(1, 'At least one item must be confirmed')
});

function makeError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.expose = true;
  return err;
}

async function uploadBill(req, res, next) {
  try {
    const parsed = uploadBillSchema.safeParse(req.body);
    if (!parsed.success) {
      throw makeError('Photo is required.', 400, 'INVALID_INPUT');
    }
    const { imageBase64, mediaType } = parsed.data;

    const extracted = await extractionService.extractBillLineItems({
      imageBase64,
      mediaType,
    });

    const bill = await billsModel.createBill({
      uploadedByUserId: req.user.userId,
      supplierName: extracted.supplierName,
    });

    const processedItems = [];
    for (const item of extracted.items) {
      const match = await matchingService.findBestMatch({
        category: null, // bills could have mixed categories
        extractedName: item.name,
      });

      const lineItem = await billsModel.createBillLineItem({
        billId: bill.id,
        matchedProductId: match ? match.product.id : null,
        rawExtracted: item,
        isNewProduct: !match,
      });

      processedItems.push({
        id: lineItem.id,
        rawExtracted: item,
        isNewProduct: !match,
        match: match ? {
          productId: match.product.id,
          name: match.product.name,
          currentQty: match.product.current_qty,
          score: match.score,
        } : null
      });
    }

    await billsModel.updateTotalItems(bill.id, processedItems.length);

    res.json({
      billId: bill.id,
      supplierName: extracted.supplierName,
      items: processedItems,
    });
  } catch (err) {
    next(err);
  }
}

async function confirmBill(req, res, next) {
  try {
    const parsed = confirmBillSchema.safeParse(req.body);
    if (!parsed.success) {
      throw makeError('Please check the confirmation details.', 400, 'INVALID_INPUT');
    }

    const billId = Number(req.params.id);
    if (!Number.isInteger(billId)) {
      throw makeError('Invalid bill reference.', 400, 'INVALID_INPUT');
    }

    const result = await inventoryService.confirmBillEvent({
      billId,
      items: parsed.data.items,
      confirmedByUserId: req.user.userId,
    });

    res.json({ success: true, processedCount: result.count });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadBill, confirmBill };
