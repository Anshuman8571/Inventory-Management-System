const { z } = require('zod');

// Categories are now user-created (see migration 007 + categories.model.js) rather
// than a fixed list, so this only validates shape/length. Whether the category
// actually exists is checked against the categories table in scan.controller.js —
// that needs a DB call, which doesn't belong in a synchronous zod schema.
const scanRequestSchema = z
  .object({
    category: z.string().trim().min(1, 'Category is required').max(40),
    imageBase64: z.string().optional(),
    mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
    flowType: z.enum(['take_out', 'add_stock']).default('take_out'),
    isManual: z.boolean().optional().default(false),
  })
  .refine((data) => data.isManual || (data.imageBase64 && data.imageBase64.length > 0), {
    message: 'Photo is required for automatic scanning',
    path: ['imageBase64'],
  });

const scanConfirmSchema = z
  .object({
    qty: z.number().int().positive('Quantity must be a positive number'),
    isNewProduct: z.boolean().default(false),
    // Lets the confirm step target an existing product directly — used when manual
    // entry (or a failed/incorrect match) should update a real product's stock instead
    // of always creating a new one (see memory.md: manual entry duplicate-product fix).
    selectedProductId: z.number().int().positive().optional(),
    newProductDetails: z
      .object({
        name: z.string().min(1),
        company: z.string().optional(),
        unit: z.string().optional(),
        attributes: z.record(z.any()).optional(),
        lowStockAt: z.number().int().min(0).max(1000000).optional(),
      })
      .optional(),
    correctedFields: z.record(z.any()).optional(),
  })
  .refine((data) => !data.isNewProduct || !!data.newProductDetails, {
    message: 'Product details are required when adding a new product.',
    path: ['newProductDetails'],
  });

module.exports = { scanRequestSchema, scanConfirmSchema };