const extractionService = require('../services/extraction.service');
const matchingService = require('../services/matching.service');
const inventoryService = require('../services/inventory.service');
const pricingService = require('../services/pricing.service');
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
    unitPrice: z.number().nullable().optional(),
    tradeDiscount: z.number().nullable().optional(),
    schemeDiscount: z.number().nullable().optional(),
    gstPercent: z.number().nullable().optional(),
    hsnCode: z.string().nullable().optional(),
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

      // Compare against the matched product's last known price for display in the
      // review table — nothing is persisted yet, that only happens on confirm.
      const priceInfo = match
        ? pricingService.compare(match.product.last_known_price, item.price)
        : pricingService.compare(null, item.price);

      const lineItem = await billsModel.createBillLineItem({
        billId: bill.id,
        matchedProductId: match ? match.product.id : null,
        rawExtracted: item,
        isNewProduct: !match,
        unitPrice: item.unitPrice ?? item.price ?? null, // Fallback for old fields
        hsnCode: item.hsnCode,
        tradeDiscount: item.tradeDiscount,
        schemeDiscount: item.schemeDiscount,
        gstPercent: item.gstPercent,
        netAmount: item.netAmount,
      });

      processedItems.push({
        id: lineItem.id,
        rawExtracted: item,
        isNewProduct: !match,
        priceInfo,
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